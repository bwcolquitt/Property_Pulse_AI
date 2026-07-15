"""Team Messaging - in-app communication between property manager, cleaners, maintenance, and other trades.

Features:
- 1-to-1 and group conversations
- Photo attachments (base64) and voice notes (base64)
- Property tagging (link a conversation/message to a property)
- Convert message to task/issue (adds to sender's or recipient's TODO list)
- Push notification on new message
- Unread count per conversation
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/messages", tags=["messages"])

def get_db(request: Request):
    return request.app.state.db


class CreateConversationInput(BaseModel):
    participant_ids: List[str]  # list of user_ids (excluding self)
    conversation_type: str = "direct"  # 'direct' | 'group'
    name: str = ""  # group name (only for groups)
    property_id: Optional[str] = None  # optional property tag


class MessageCreate(BaseModel):
    body: str = ""
    message_type: str = "text"  # 'text' | 'photo' | 'voice'
    attachment_base64: Optional[str] = None  # for photo/voice
    attachment_mime: Optional[str] = None    # e.g. 'image/jpeg' or 'audio/m4a'
    property_id: Optional[str] = None  # tag this specific message with a property


class ConvertToTaskInput(BaseModel):
    assignee_user_id: str  # who owns the task
    title: str
    priority: str = "medium"  # low | medium | high | urgent
    property_id: Optional[str] = None
    trade_type: str = "general"  # general | cleaning | maintenance | plumbing | electrical | hvac


# ==================== TEAM DIRECTORY ====================

@router.get("/team")
async def list_team_members(request: Request):
    """List all users in the current tenant that can be messaged (excluding self)."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    users = await db.users.find(
        {"active": {"$ne": False}, "_id": {"$ne": ObjectId(user["id"])}},
        {"password_hash": 0}
    ).to_list(200)
    result = []
    for u in users:
        result.append({
            "id": str(u["_id"]),
            "first_name": u.get("first_name", ""),
            "last_name": u.get("last_name", ""),
            "email": u.get("email", ""),
            "role": u.get("role", ""),
            "avatar_url": u.get("avatar_url", ""),
        })
    # Group by role for easier UI rendering
    return result


# ==================== CONVERSATIONS ====================

@router.get("/conversations")
async def list_conversations(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    participations = await db.conversation_participants.find({"user_id": user["id"]}).to_list(500)
    conv_ids = [p["conversation_id"] for p in participations]
    conversations = []
    for cid in conv_ids:
        try:
            conv = await db.conversations.find_one({"_id": ObjectId(cid)})
        except Exception:
            continue
        if not conv:
            continue
        doc = serialize_doc(conv)
        # last message
        last_msg = await db.messages.find({"conversation_id": cid}).sort("created_at", -1).limit(1).to_list(1)
        doc["last_message"] = serialize_doc(last_msg[0]) if last_msg else None
        # participants (with names + roles)
        parts = await db.conversation_participants.find({"conversation_id": cid}).to_list(20)
        participants = []
        for p in parts:
            try:
                u = await db.users.find_one({"_id": ObjectId(p["user_id"])})
                if u:
                    participants.append({
                        "id": str(u["_id"]),
                        "name": f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or u.get("email", ""),
                        "role": u.get("role", ""),
                        "is_me": p["user_id"] == user["id"],
                    })
            except Exception:
                pass
        doc["participants"] = participants
        doc["participant_names"] = [p["name"] for p in participants if not p["is_me"]]
        # Unread count = messages after user's last_read_at
        my_participation = next((p for p in parts if p["user_id"] == user["id"]), None)
        last_read = (my_participation or {}).get("last_read_at", "1970-01-01")
        doc["unread_count"] = await db.messages.count_documents({
            "conversation_id": cid,
            "created_at": {"$gt": last_read},
            "sender_user_id": {"$ne": user["id"]},
        })
        # Property info
        if conv.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(conv["property_id"])})
                if prop:
                    doc["property_name"] = prop.get("nickname") or prop.get("name", "")
            except Exception:
                pass
        conversations.append(doc)
    # Sort by last-message time desc
    conversations.sort(key=lambda c: (c.get("last_message") or {}).get("created_at", c.get("created_at", "")), reverse=True)
    return conversations


@router.post("/conversations")
async def create_conversation(input: CreateConversationInput, request: Request):
    """Create a new conversation (1-to-1 or group). For 1-to-1, reuses existing conversation if one exists."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    all_participant_ids = list(set([user["id"]] + input.participant_ids))
    if len(all_participant_ids) < 2:
        raise HTTPException(400, "Need at least 2 participants")

    is_direct = input.conversation_type == "direct" and len(all_participant_ids) == 2
    # Reuse existing 1-to-1 conversation if it already exists
    if is_direct:
        other = input.participant_ids[0]
        my_convs = await db.conversation_participants.find({"user_id": user["id"]}).to_list(500)
        for p in my_convs:
            other_p = await db.conversation_participants.find_one({
                "conversation_id": p["conversation_id"],
                "user_id": other,
            })
            if other_p:
                # Check it's a direct chat (only 2 participants)
                count = await db.conversation_participants.count_documents({"conversation_id": p["conversation_id"]})
                if count == 2:
                    conv = await db.conversations.find_one({"_id": ObjectId(p["conversation_id"])})
                    if conv:
                        return {"id": p["conversation_id"], "existing": True, **serialize_doc(conv)}

    now = datetime.now(timezone.utc).isoformat()
    conv_doc = {
        "conversation_type": "group" if not is_direct else "direct",
        "name": input.name or "",
        "property_id": input.property_id,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    res = await db.conversations.insert_one(conv_doc)
    cid = str(res.inserted_id)
    # Add participants
    for uid in all_participant_ids:
        await db.conversation_participants.insert_one({
            "conversation_id": cid,
            "user_id": uid,
            "joined_at": now,
            "last_read_at": now,
        })
    conv_doc["id"] = cid
    conv_doc.pop("_id", None)
    return conv_doc


@router.get("/conversations/{conversation_id}")
async def get_conversation_messages(conversation_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    # Verify user is a participant
    participation = await db.conversation_participants.find_one({
        "conversation_id": conversation_id, "user_id": user["id"],
    })
    if not participation:
        raise HTTPException(403, "Not a participant of this conversation")

    messages = await db.messages.find({"conversation_id": conversation_id}).sort("created_at", 1).to_list(500)
    result = []
    for m in messages:
        doc = serialize_doc(m)
        if m.get("sender_user_id"):
            try:
                u = await db.users.find_one({"_id": ObjectId(m["sender_user_id"])})
                if u:
                    doc["sender_name"] = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or u.get("email", "")
                    doc["sender_role"] = u.get("role", "")
                doc["is_me"] = m["sender_user_id"] == user["id"]
            except Exception:
                doc["sender_name"] = "Unknown"
                doc["is_me"] = False
        result.append(doc)
    # Mark as read
    await db.conversation_participants.update_one(
        {"conversation_id": conversation_id, "user_id": user["id"]},
        {"$set": {"last_read_at": datetime.now(timezone.utc).isoformat()}},
    )
    return result


@router.post("/conversations/{conversation_id}")
async def send_message(conversation_id: str, input: MessageCreate, request: Request):
    """Send a message. Also triggers push notifications to other participants."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    # Verify participation
    participation = await db.conversation_participants.find_one({
        "conversation_id": conversation_id, "user_id": user["id"],
    })
    if not participation:
        raise HTTPException(403, "Not a participant")
    if not input.body and not input.attachment_base64:
        raise HTTPException(400, "Message must have body or attachment")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "conversation_id": conversation_id,
        "sender_user_id": user["id"],
        "message_type": input.message_type,
        "body": input.body,
        "attachment_base64": input.attachment_base64 or "",
        "attachment_mime": input.attachment_mime or "",
        "property_id": input.property_id,
        "converted_to_task_id": None,
        "created_at": now,
    }
    result = await db.messages.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    doc["sender_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("email", "")
    doc["sender_role"] = user.get("role", "")
    doc["is_me"] = True

    # Update conversation updated_at
    await db.conversations.update_one({"_id": ObjectId(conversation_id)}, {"$set": {"updated_at": now}})

    # Push notification to other participants
    try:
        parts = await db.conversation_participants.find({
            "conversation_id": conversation_id, "user_id": {"$ne": user["id"]},
        }).to_list(20)
        recipient_ids = [p["user_id"] for p in parts]
        if recipient_ids:
            sender_name = doc["sender_name"] or "Someone"
            preview = input.body[:80] if input.body else ("📷 Photo" if input.message_type == "photo" else "🎤 Voice note")
            # Import push helper lazily to avoid circular imports
            from routes.push_notifications import send_push_to_users
            await send_push_to_users(
                db._db if hasattr(db, "_db") else db,  # unwrap tenant-scoped db for raw access
                recipient_ids,
                title=f"{sender_name}",
                body=preview,
                data={"type": "message", "conversation_id": conversation_id, "message_id": doc["id"]},
            )
    except Exception as e:
        logger.warning(f"push notify failed: {e}")

    return doc


# ==================== CONVERT MESSAGE TO TASK ====================

@router.post("/{message_id}/convert-to-task")
async def convert_to_task(message_id: str, input: ConvertToTaskInput, request: Request):
    """Convert a message into a maintenance issue/task assigned to a user."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    msg = await db.messages.find_one({"_id": ObjectId(message_id)})
    if not msg:
        raise HTTPException(404, "Message not found")

    # Verify user is a participant of the conversation
    participation = await db.conversation_participants.find_one({
        "conversation_id": msg["conversation_id"], "user_id": user["id"],
    })
    if not participation:
        raise HTTPException(403, "Not authorized")

    now = datetime.now(timezone.utc).isoformat()
    issue_doc = {
        "property_id": input.property_id or msg.get("property_id"),
        "turnover_id": None,
        "reservation_id": None,
        "issue_type": "maintenance",
        "trade_type": input.trade_type,
        "title": input.title or (msg.get("body", "")[:80] or "Task from message"),
        "description": f"Converted from team message.\n\nOriginal: {msg.get('body', '')}",
        "location_in_property": "",
        "source_type": "team_message",
        "source_user_id": user["id"],
        "source_message_id": message_id,
        "priority": input.priority,
        "status": "new",
        "guest_impact_level": "low",
        "blocks_check_in": False,
        "assigned_provider_id": input.assignee_user_id,
        "created_at": now,
        "updated_at": now,
    }
    res = await db.issues.insert_one(issue_doc)
    issue_id = str(res.inserted_id)

    # Update message to link the task
    await db.messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"converted_to_task_id": issue_id, "converted_at": now, "converted_by": user["id"]}},
    )

    # Push notification to the assignee
    try:
        if input.assignee_user_id != user["id"]:
            from routes.push_notifications import send_push_to_users
            await send_push_to_users(
                db._db if hasattr(db, "_db") else db,
                [input.assignee_user_id],
                title="New task assigned",
                body=input.title,
                data={"type": "task", "issue_id": issue_id},
            )
    except Exception as e:
        logger.warning(f"assignee push failed: {e}")

    return {"success": True, "issue_id": issue_id, "message_id": message_id}


# ==================== UNREAD COUNT ====================

@router.get("/unread-count")
async def unread_count(request: Request):
    """Total unread messages across all conversations for badge."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    parts = await db.conversation_participants.find({"user_id": user["id"]}).to_list(500)
    total = 0
    for p in parts:
        last_read = p.get("last_read_at", "1970-01-01")
        count = await db.messages.count_documents({
            "conversation_id": p["conversation_id"],
            "created_at": {"$gt": last_read},
            "sender_user_id": {"$ne": user["id"]},
        })
        total += count
    return {"unread": total}


@router.get("/recent-unread")
async def recent_unread(request: Request):
    """Latest 5 unread messages across all conversations (for in-app banner)."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    parts = await db.conversation_participants.find({"user_id": user["id"]}).to_list(500)
    all_unread = []
    for p in parts:
        last_read = p.get("last_read_at", "1970-01-01")
        msgs = await db.messages.find({
            "conversation_id": p["conversation_id"],
            "created_at": {"$gt": last_read},
            "sender_user_id": {"$ne": user["id"]},
        }).sort("created_at", -1).limit(5).to_list(5)
        for m in msgs:
            doc = serialize_doc(m)
            try:
                u = await db.users.find_one({"_id": ObjectId(m["sender_user_id"])})
                doc["sender_name"] = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() if u else "Unknown"
                doc["sender_role"] = u.get("role", "") if u else ""
            except Exception:
                doc["sender_name"] = "Unknown"
            all_unread.append(doc)
    all_unread.sort(key=lambda m: m.get("created_at", ""), reverse=True)
    return all_unread[:5]

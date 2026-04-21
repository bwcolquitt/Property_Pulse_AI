"""Host Inbox - Guest Message Triage.

Based on host feedback: guests should NOT be able to create maintenance issues directly.
Instead, all guest requests/reports flow to the Host Inbox where the host can:
  - Reply to the guest
  - Convert to a real maintenance Issue
  - Mark resolved (not actionable)
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/guest-messages", tags=["guest-messages"])

def get_db(request: Request):
    return request.app.state.db

# ===== Create (from Guest Portal) =====
class NewGuestMessage(BaseModel):
    property_id: str = ""
    reservation_id: str = ""
    category: str = "question"  # question | request | problem | compliment
    subject: str
    body: str = ""
    photos: List[str] = []  # base64 URLs

@router.post("")
async def create_guest_message(input: NewGuestMessage, request: Request):
    """Guest sends a message to the host. Does NOT directly create an issue."""
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc).isoformat()

    prop = None
    if input.property_id:
        try:
            prop = await db.properties.find_one({"_id": ObjectId(input.property_id)})
        except Exception:
            pass

    doc = {
        "property_id": input.property_id,
        "property_name": (prop or {}).get("nickname") or (prop or {}).get("name", ""),
        "reservation_id": input.reservation_id,
        "guest_id": user["id"],
        "guest_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or "Guest",
        "guest_email": user.get("email", ""),
        "category": input.category,
        "subject": input.subject,
        "body": input.body,
        "photos": input.photos,
        "status": "new",  # new | replied | converted | resolved
        "host_reply": "",
        "replied_at": "",
        "converted_issue_id": "",
        "created_at": now,
        "updated_at": now,
    }
    res = await db.guest_messages.insert_one(doc)

    # Notify host (a soft notification, NOT an issue)
    await db.notifications.insert_one({
        "type": "guest_message",
        "title": f"Guest message: {input.subject}",
        "body": f"{doc['guest_name']} at {doc['property_name']}: {input.body[:120]}",
        "link": "/host-inbox",
        "read": False,
        "created_at": now,
    })

    return {"success": True, "message": "Your message was sent to the host. They'll respond shortly.", "id": str(res.inserted_id)}

# ===== List (for Host) =====
@router.get("")
async def list_guest_messages(request: Request, status: Optional[str] = None, property_id: Optional[str] = None):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Host only")
    q = {}
    if status:
        q["status"] = status
    if property_id:
        q["property_id"] = property_id
    msgs = await db.guest_messages.find(q).sort("created_at", -1).to_list(500)
    return [serialize_doc(m) for m in msgs]

@router.get("/stats")
async def guest_messages_stats(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Host only")
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    counts = {}
    async for row in db.guest_messages.aggregate(pipeline):
        counts[row["_id"] or "unknown"] = row["count"]
    return {
        "new": counts.get("new", 0),
        "replied": counts.get("replied", 0),
        "converted": counts.get("converted", 0),
        "resolved": counts.get("resolved", 0),
        "total": sum(counts.values()),
    }

# ===== Host Actions =====
class ReplyInput(BaseModel):
    reply: str

@router.put("/{msg_id}/reply")
async def reply_to_guest(msg_id: str, input: ReplyInput, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Host only")
    now = datetime.now(timezone.utc).isoformat()
    await db.guest_messages.update_one(
        {"_id": ObjectId(msg_id)},
        {"$set": {"status": "replied", "host_reply": input.reply, "replied_at": now, "replied_by": user.get("first_name", ""), "updated_at": now}},
    )
    return {"success": True}

class ConvertToIssueInput(BaseModel):
    trade_type: str = "general"
    priority: str = "medium"  # low | medium | high | urgent
    notes: str = ""

@router.put("/{msg_id}/convert-to-issue")
async def convert_to_issue(msg_id: str, input: ConvertToIssueInput, request: Request):
    """Host triages a guest message into a real maintenance issue."""
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Host only")

    msg = await db.guest_messages.find_one({"_id": ObjectId(msg_id)})
    if not msg:
        raise HTTPException(404, "Message not found")

    now = datetime.now(timezone.utc).isoformat()
    issue_doc = {
        "property_id": msg.get("property_id", ""),
        "title": f"[Guest] {msg.get('subject', '')}",
        "description": f"{msg.get('body', '')}\n\nHost notes: {input.notes}".strip(),
        "priority": input.priority,
        "status": "new",
        "trade_type": input.trade_type,
        "source_user_id": user["id"],
        "guest_reported": True,
        "guest_message_id": msg_id,
        "reservation_id": msg.get("reservation_id", ""),
        "created_at": now,
    }
    res = await db.issues.insert_one(issue_doc)
    issue_id = str(res.inserted_id)

    await db.guest_messages.update_one(
        {"_id": ObjectId(msg_id)},
        {"$set": {"status": "converted", "converted_issue_id": issue_id, "updated_at": now}},
    )
    return {"success": True, "issue_id": issue_id}

@router.put("/{msg_id}/resolve")
async def resolve_guest_message(msg_id: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Host only")
    await db.guest_messages.update_one(
        {"_id": ObjectId(msg_id)},
        {"$set": {"status": "resolved", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True}

@router.get("/thread/{reservation_id}")
async def get_thread_for_guest(reservation_id: str, request: Request):
    """Guest views their own thread with the host."""
    db = get_db(request)
    user = await get_current_user(request, db)
    msgs = await db.guest_messages.find({"reservation_id": reservation_id}).sort("created_at", 1).to_list(200)
    return [serialize_doc(m) for m in msgs]

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/messages", tags=["messages"])

def get_db(request: Request):
    return request.app.state.db

class MessageCreate(BaseModel):
    body: str
    message_type: str = "text"

@router.get("/conversations")
async def list_conversations(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    # Get all conversations where user is a participant
    participations = await db.conversation_participants.find({"user_id": user["id"]}).to_list(100)
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
        # Get last message
        last_msg = await db.messages.find({"conversation_id": cid}).sort("created_at", -1).limit(1).to_list(1)
        doc["last_message"] = serialize_doc(last_msg[0]) if last_msg else None
        # Get participants
        parts = await db.conversation_participants.find({"conversation_id": cid}).to_list(20)
        participant_names = []
        for p in parts:
            if p["user_id"] != user["id"]:
                try:
                    u = await db.users.find_one({"_id": ObjectId(p["user_id"])})
                    participant_names.append(f"{u.get('first_name', '')} {u.get('last_name', '')}" if u else "Unknown")
                except Exception:
                    participant_names.append("Unknown")
        doc["participant_names"] = participant_names
        # Unread count
        doc["unread_count"] = 0
        conversations.append(doc)
    return conversations

@router.get("/conversations/{conversation_id}")
async def get_conversation_messages(conversation_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    messages = await db.messages.find({"conversation_id": conversation_id}).sort("created_at", 1).to_list(200)
    result = []
    for m in messages:
        doc = serialize_doc(m)
        if m.get("sender_user_id"):
            try:
                u = await db.users.find_one({"_id": ObjectId(m["sender_user_id"])})
                doc["sender_name"] = f"{u.get('first_name', '')} {u.get('last_name', '')}" if u else "Unknown"
                doc["is_me"] = m["sender_user_id"] == user["id"]
            except Exception:
                doc["sender_name"] = "Unknown"
                doc["is_me"] = False
        result.append(doc)
    return result

@router.post("/conversations/{conversation_id}")
async def send_message(conversation_id: str, input: MessageCreate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    doc = {
        "conversation_id": conversation_id,
        "sender_user_id": user["id"],
        "message_type": input.message_type,
        "body": input.body,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.messages.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc["sender_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}"
    doc["is_me"] = True
    return doc

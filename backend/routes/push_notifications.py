"""Expo Push Notifications - register device tokens and send pushes.

Uses the Expo Push API (https://exp.host/--/api/v2/push/send) which accepts
ExponentPushToken[...] tokens from Expo apps.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
import httpx
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/push", tags=["push"])

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

def get_db(request: Request):
    return request.app.state.db

class RegisterTokenInput(BaseModel):
    token: str  # ExponentPushToken[...]
    platform: Optional[str] = ""  # ios | android | web
    device_name: Optional[str] = ""

@router.post("/register")
async def register_token(input: RegisterTokenInput, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc).isoformat()
    await db.push_tokens.update_one(
        {"user_id": user["id"], "token": input.token},
        {"$set": {"user_id": user["id"], "user_role": user.get("role", ""), "token": input.token,
                   "platform": input.platform, "device_name": input.device_name, "updated_at": now},
         "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"success": True}

@router.delete("/unregister")
async def unregister_token(token: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    await db.push_tokens.delete_one({"user_id": user["id"], "token": token})
    return {"success": True}

class SendPushInput(BaseModel):
    user_id: Optional[str] = ""
    role: Optional[str] = ""  # send to all users with this role
    title: str
    body: str
    data: Optional[dict] = None

@router.post("/send")
async def send_push(input: SendPushInput, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    q = {}
    if input.user_id:
        q["user_id"] = input.user_id
    elif input.role:
        q["user_role"] = input.role
    tokens = await db.push_tokens.find(q).to_list(500)
    if not tokens:
        return {"success": True, "sent": 0, "message": "No registered devices for recipient"}
    result = await _send_expo_push(tokens, input.title, input.body, input.data or {})
    return result

async def _send_expo_push(tokens: List[dict], title: str, body: str, data: dict):
    """Send a push via Expo Push API. Returns {sent, errors}."""
    messages = [
        {"to": t["token"], "title": title, "body": body, "data": data, "sound": "default", "priority": "high"}
        for t in tokens if t.get("token", "").startswith("ExponentPushToken[")
    ]
    if not messages:
        return {"success": True, "sent": 0, "message": "No valid Expo tokens"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(EXPO_PUSH_URL, json=messages, headers={"Accept": "application/json", "Content-Type": "application/json"})
            if r.status_code in (200, 202):
                return {"success": True, "sent": len(messages), "response": r.json()}
            return {"success": False, "sent": 0, "error": f"{r.status_code} {r.text[:200]}"}
    except Exception as e:
        return {"success": False, "sent": 0, "error": str(e)}

# Helper for other routes to call push directly
async def notify_role(db, role: str, title: str, body: str, data: dict = None):
    tokens = await db.push_tokens.find({"user_role": role}).to_list(500)
    if not tokens:
        return
    try:
        await _send_expo_push(tokens, title, body, data or {})
    except Exception as e:
        logger.warning(f"Push failed: {e}")


async def send_push_to_users(db, user_ids: List[str], title: str, body: str, data: dict = None):
    """Send push to a specific list of user_ids (used by messaging + task assignments)."""
    if not user_ids:
        return
    tokens = await db.push_tokens.find({"user_id": {"$in": user_ids}}).to_list(500)
    if not tokens:
        return
    try:
        await _send_expo_push(tokens, title, body, data or {})
    except Exception as e:
        logger.warning(f"Push failed: {e}")

"""SMS Delivery with pluggable provider adapters.

Default provider: QUO (https://quo.co) - owner-friendly, affordable.
SaaS customers can plug in their own provider (Twilio, MessageBird, Bandwidth, etc.)
by configuring `custom_api` provider.

For this MVP: we write the integration scaffolding (stores config, dispatches calls)
but actual HTTP send is stubbed unless api_key is populated.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
import httpx
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sms", tags=["sms"])

def get_db(request: Request):
    return request.app.state.db

SUPPORTED_PROVIDERS = [
    {"id": "quo", "name": "QUO (recommended)", "website": "https://quo.co", "fields": ["api_key", "from_number"]},
    {"id": "twilio", "name": "Twilio", "website": "https://twilio.com", "fields": ["account_sid", "auth_token", "from_number"]},
    {"id": "messagebird", "name": "MessageBird", "website": "https://messagebird.com", "fields": ["api_key", "from_number"]},
    {"id": "custom_api", "name": "Custom HTTP API", "website": "", "fields": ["webhook_url", "api_key", "from_number"]},
    {"id": "disabled", "name": "Disabled (simulate only)", "website": "", "fields": []},
]

# ===== Config =====
@router.get("/providers")
async def list_providers():
    return SUPPORTED_PROVIDERS

@router.get("/config")
async def get_config(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    config = await db.sms_config.find_one({"tenant_id": user.get("tenant_id", "default")}) or {}
    # Mask secrets
    for secret in ["api_key", "auth_token", "account_sid"]:
        if config.get(secret):
            val = config[secret]
            config[secret + "_masked"] = val[:4] + "****" + val[-4:] if len(val) > 8 else "****"
            config.pop(secret, None)
    config.pop("_id", None)
    if not config:
        config = {"provider": "disabled", "from_number": "", "enabled": False}
    return config

class SmsConfigInput(BaseModel):
    provider: str  # quo | twilio | messagebird | custom_api | disabled
    api_key: Optional[str] = ""
    account_sid: Optional[str] = ""
    auth_token: Optional[str] = ""
    webhook_url: Optional[str] = ""
    from_number: Optional[str] = ""
    enabled: bool = True

@router.put("/config")
async def update_config(input: SmsConfigInput, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    updates = {k: v for k, v in input.dict(exclude_unset=True).items() if v is not None and v != ""}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = user["id"]
    await db.sms_config.update_one({"tenant_id": user.get("tenant_id", "default")}, {"$set": {**updates, "tenant_id": user.get("tenant_id", "default")}}, upsert=True)
    return {"success": True}

# ===== Send =====
class SendSmsInput(BaseModel):
    to: str  # phone number
    body: str
    purpose: str = "general"  # check_in_link | check_out_reminder | welcome | general
    reservation_id: Optional[str] = ""

@router.post("/send")
async def send_sms(input: SendSmsInput, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")

    config = await db.sms_config.find_one({"tenant_id": user.get("tenant_id", "default")}) or {}
    provider = config.get("provider", "disabled")
    enabled = config.get("enabled", False)
    from_number = config.get("from_number", "")

    now = datetime.now(timezone.utc).isoformat()
    log_doc = {
        "to": input.to,
        "from_number": from_number,
        "body": input.body,
        "purpose": input.purpose,
        "provider": provider,
        "reservation_id": input.reservation_id,
        "sent_at": now,
        "status": "pending",
        "response": "",
    }

    if not enabled or provider == "disabled":
        log_doc["status"] = "simulated"
        log_doc["response"] = "SMS provider disabled. Message not sent (simulation only)."
        await db.sms_logs.insert_one(log_doc)
        return {"success": True, "simulated": True, "message": "SMS simulated (provider disabled). Configure an SMS provider in Settings to send real messages."}

    # Dispatch to adapter
    try:
        if provider == "quo":
            resp = await _send_quo(config, input.to, input.body)
        elif provider == "twilio":
            resp = await _send_twilio(config, input.to, input.body)
        elif provider == "messagebird":
            resp = await _send_messagebird(config, input.to, input.body)
        elif provider == "custom_api":
            resp = await _send_custom(config, input.to, input.body)
        else:
            resp = {"ok": False, "detail": "Unknown provider"}

        log_doc["status"] = "sent" if resp.get("ok") else "failed"
        log_doc["response"] = str(resp)[:500]
        await db.sms_logs.insert_one(log_doc)
        return {"success": resp.get("ok", False), "message": resp.get("detail", "")}
    except Exception as e:
        log_doc["status"] = "error"
        log_doc["response"] = str(e)[:500]
        await db.sms_logs.insert_one(log_doc)
        return {"success": False, "message": str(e)}

@router.get("/logs")
async def get_logs(request: Request, limit: int = 50):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    logs = await db.sms_logs.find({}).sort("sent_at", -1).to_list(limit)
    return [serialize_doc(l) for l in logs]

# ===== Provider adapters =====
async def _send_quo(config, to, body):
    api_key = config.get("api_key")
    from_number = config.get("from_number")
    if not api_key or not from_number:
        return {"ok": False, "detail": "QUO not configured (missing api_key or from_number)"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                "https://api.quo.co/v1/messages",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"from": from_number, "to": to, "body": body},
            )
            if r.status_code in (200, 201, 202):
                return {"ok": True, "detail": "Sent via QUO"}
            return {"ok": False, "detail": f"QUO: {r.status_code} {r.text[:200]}"}
    except Exception as e:
        return {"ok": False, "detail": f"QUO error: {e}"}

async def _send_twilio(config, to, body):
    sid = config.get("account_sid"); token = config.get("auth_token"); from_number = config.get("from_number")
    if not (sid and token and from_number):
        return {"ok": False, "detail": "Twilio not fully configured"}
    try:
        async with httpx.AsyncClient(timeout=10, auth=(sid, token)) as client:
            r = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                data={"From": from_number, "To": to, "Body": body},
            )
            if r.status_code in (200, 201):
                return {"ok": True, "detail": "Sent via Twilio"}
            return {"ok": False, "detail": f"Twilio: {r.status_code} {r.text[:200]}"}
    except Exception as e:
        return {"ok": False, "detail": f"Twilio error: {e}"}

async def _send_messagebird(config, to, body):
    api_key = config.get("api_key"); from_number = config.get("from_number")
    if not (api_key and from_number):
        return {"ok": False, "detail": "MessageBird not configured"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                "https://rest.messagebird.com/messages",
                headers={"Authorization": f"AccessKey {api_key}"},
                json={"originator": from_number, "recipients": [to], "body": body},
            )
            if r.status_code in (200, 201):
                return {"ok": True, "detail": "Sent via MessageBird"}
            return {"ok": False, "detail": f"MessageBird: {r.status_code} {r.text[:200]}"}
    except Exception as e:
        return {"ok": False, "detail": f"MessageBird error: {e}"}

async def _send_custom(config, to, body):
    webhook_url = config.get("webhook_url"); api_key = config.get("api_key"); from_number = config.get("from_number")
    if not webhook_url:
        return {"ok": False, "detail": "Custom webhook URL not configured"}
    try:
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(webhook_url, headers=headers, json={"from": from_number, "to": to, "body": body})
            if r.status_code in (200, 201, 202):
                return {"ok": True, "detail": "Sent via custom webhook"}
            return {"ok": False, "detail": f"Custom: {r.status_code} {r.text[:200]}"}
    except Exception as e:
        return {"ok": False, "detail": f"Custom error: {e}"}

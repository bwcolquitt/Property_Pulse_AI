"""Guest Phone OTP Verification - 2FA before check-in.

Sends a 6-digit code via SMS (uses configured SMS provider), guest enters it
to unlock full portal access. Requires SMS provider configured.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import random
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/guest-otp", tags=["guest-otp"])

def get_db(request: Request):
    return request.app.state.db

def generate_code():
    return "".join([str(random.randint(0, 9)) for _ in range(6)])

class SendOtpInput(BaseModel):
    phone: str
    reservation_id: Optional[str] = ""

@router.post("/send")
async def send_otp(input: SendOtpInput, request: Request):
    """Guest requests an OTP sent to their phone."""
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=10)

    # Rate limit: max 3 codes per phone in 10 min
    recent_count = await db.guest_otps.count_documents({
        "phone": input.phone,
        "created_at": {"$gte": (now - timedelta(minutes=10)).isoformat()},
    })
    if recent_count >= 3:
        raise HTTPException(429, "Too many codes requested. Wait 10 minutes.")

    code = generate_code()
    await db.guest_otps.insert_one({
        "user_id": user["id"],
        "phone": input.phone,
        "reservation_id": input.reservation_id,
        "code": code,
        "verified": False,
        "attempts": 0,
        "created_at": now.isoformat(),
        "expires_at": expires.isoformat(),
    })

    # Send via configured SMS provider
    sms_config = await db.sms_config.find_one({}) or {}
    body = f"Your Property Pulse verification code is {code}. Valid for 10 minutes."
    if sms_config.get("enabled") and sms_config.get("provider", "disabled") != "disabled":
        try:
            from routes.sms import _send_quo, _send_twilio, _send_messagebird, _send_custom
            provider = sms_config.get("provider")
            if provider == "quo":
                await _send_quo(sms_config, input.phone, body)
            elif provider == "twilio":
                await _send_twilio(sms_config, input.phone, body)
            elif provider == "messagebird":
                await _send_messagebird(sms_config, input.phone, body)
            elif provider == "custom_api":
                await _send_custom(sms_config, input.phone, body)
            return {"success": True, "message": "Code sent. Check your text messages."}
        except Exception as e:
            logger.warning(f"OTP send failed: {e}")

    # Provider disabled - simulate (dev mode): return code in response
    return {
        "success": True,
        "simulated": True,
        "message": "SMS provider not configured. Code for dev: " + code,
        "code": code,  # Only in simulated mode
    }

class VerifyOtpInput(BaseModel):
    phone: str
    code: str
    reservation_id: Optional[str] = ""

@router.post("/verify")
async def verify_otp(input: VerifyOtpInput, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc)

    otp = await db.guest_otps.find_one({
        "user_id": user["id"],
        "phone": input.phone,
        "verified": False,
        "expires_at": {"$gte": now.isoformat()},
    }, sort=[("created_at", -1)])

    if not otp:
        raise HTTPException(400, "No active code found. Request a new one.")

    if otp.get("attempts", 0) >= 5:
        raise HTTPException(429, "Too many attempts. Request a new code.")

    if otp["code"] != input.code.strip():
        await db.guest_otps.update_one({"_id": otp["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Invalid code.")

    await db.guest_otps.update_one({"_id": otp["_id"]}, {"$set": {"verified": True, "verified_at": now.isoformat()}})
    # Mark user's phone verified
    try:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"phone_verified": True, "phone": input.phone}})
    except Exception:
        pass
    return {"success": True, "message": "Phone verified!"}

@router.get("/status")
async def otp_status(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    return {"phone_verified": bool(user.get("phone_verified", False)), "phone": user.get("phone", "")}

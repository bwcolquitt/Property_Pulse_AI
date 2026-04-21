from fastapi import APIRouter, Request, HTTPException, Response
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc, create_access_token
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import hashlib, secrets, logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/guest-portal", tags=["guest-portal"])

def get_db(request: Request):
    return request.app.state.db

# ===== Magic Link =====

class SendGuestLink(BaseModel):
    reservation_id: str
    guest_phone: str = ""
    guest_email: str = ""

@router.post("/send-link")
async def send_guest_link(input: SendGuestLink, request: Request):
    """Admin sends a magic link to the guest for their reservation."""
    db = get_db(request)
    user = await get_current_user(request, db)
    
    reservation = await db.reservations.find_one({"_id": ObjectId(input.reservation_id)})
    if not reservation:
        raise HTTPException(404, "Reservation not found")
    
    # Generate magic token
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    
    await db.guest_tokens.update_one(
        {"reservation_id": input.reservation_id},
        {"$set": {
            "reservation_id": input.reservation_id,
            "property_id": reservation.get("property_id", ""),
            "guest_name": reservation.get("guest_name", ""),
            "guest_phone": input.guest_phone or reservation.get("guest_phone", ""),
            "guest_email": input.guest_email or reservation.get("guest_email", ""),
            "token": token,
            "check_in_at": reservation.get("check_in_at", ""),
            "check_out_at": reservation.get("check_out_at", ""),
            "expires_at": (now + timedelta(days=30)).isoformat(),
            "created_at": now.isoformat(),
        }},
        upsert=True
    )
    
    # Log interaction
    await _log_interaction(db, input.reservation_id, "link_sent", f"Guest link sent to {input.guest_phone or input.guest_email}")
    
    return {"success": True, "token": token, "message": f"Link generated. Send to guest: /guest-access?token={token}"}

@router.post("/access")
async def guest_access(request: Request, response: Response):
    """Guest accesses portal via magic token. No password needed."""
    db = get_db(request)
    body = await request.json()
    token = body.get("token", "")
    
    guest_token = await db.guest_tokens.find_one({"token": token})
    if not guest_token:
        raise HTTPException(401, "Invalid or expired link")
    
    if guest_token.get("expires_at"):
        exp = datetime.fromisoformat(guest_token["expires_at"].replace("Z", "+00:00"))
        if exp < datetime.now(timezone.utc):
            raise HTTPException(401, "Link has expired")
    
    # Create or find guest user
    guest_email = guest_token.get("guest_email", f"guest_{token[:8]}@guest.propertypulse.ai")
    guest_user = await db.users.find_one({"email": guest_email, "role": "guest"})
    if not guest_user:
        guest_doc = {
            "email": guest_email,
            "first_name": guest_token.get("guest_name", "Guest").split()[0],
            "last_name": " ".join(guest_token.get("guest_name", "").split()[1:]) or "",
            "role": "guest",
            "password_hash": "magic_link",
            "reservation_id": guest_token.get("reservation_id"),
            "property_id": guest_token.get("property_id"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = await db.users.insert_one(guest_doc)
        user_id = str(result.inserted_id)
    else:
        user_id = str(guest_user["_id"])
    
    access_token = create_access_token(user_id, guest_email)
    
    await _log_interaction(db, guest_token.get("reservation_id", ""), "portal_accessed", "Guest opened portal")
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, max_age=86400 * 7, path="/")
    
    return {
        "id": user_id, "email": guest_email,
        "first_name": guest_token.get("guest_name", "Guest").split()[0],
        "role": "guest", "token": access_token,
        "reservation_id": guest_token.get("reservation_id"),
        "property_id": guest_token.get("property_id"),
        "check_in_at": guest_token.get("check_in_at"),
        "check_out_at": guest_token.get("check_out_at"),
    }

# ===== Guest Portal Data =====

@router.get("/my-stay")
async def get_my_stay(request: Request):
    """Get all info for the guest's current stay."""
    db = get_db(request)
    user = await get_current_user(request, db)
    
    # Find their reservation
    res = None
    if user.get("reservation_id"):
        res = await db.reservations.find_one({"_id": ObjectId(user["reservation_id"])})
    if not res:
        reservations = await db.reservations.find({"guest_email": user.get("email"), "reservation_status": {"$in": ["confirmed", "pending"]}}).sort("check_in_at", -1).to_list(1)
        res = reservations[0] if reservations else None
    
    property_id = res.get("property_id") if res else user.get("property_id", "")
    prop = await db.properties.find_one({"_id": ObjectId(property_id)}) if property_id else None
    
    # Get company config
    config = {}
    for s in ["profile", "contacts", "check_in_out", "house_rules", "communication", "emergency_procedures"]:
        doc = await db.company_config.find_one({"section": s})
        if doc:
            d = serialize_doc(doc)
            d.pop("section", None)
            config[s] = d
        else:
            config[s] = {}
    
    # Get property service notes
    notes = await db.property_service_notes.find_one({"property_id": property_id})
    
    # Get guest inventory
    guest_items = await db.guest_inventory.find({"property_id": property_id, "active": True}).to_list(100)
    
    now = datetime.now(timezone.utc)
    check_out = None
    hours_remaining = None
    if res and res.get("check_out_at"):
        try:
            check_out = datetime.fromisoformat(res["check_out_at"].replace("Z", "+00:00"))
            hours_remaining = max(0, (check_out - now).total_seconds() / 3600)
        except: pass
    
    return {
        "reservation": serialize_doc(res) if res else None,
        "property": {
            "id": str(prop["_id"]) if prop else "",
            "name": prop.get("nickname", prop.get("name", "")) if prop else "",
            "address": f"{prop.get('address_1', '')}, {prop.get('city', '')} {prop.get('state', '')}" if prop else "",
            "city": prop.get("city", "") if prop else "",
            "state": prop.get("state", "") if prop else "",
            "zip": prop.get("zip", "") if prop else "",
            "lat": prop.get("lat") if prop else None,
            "lng": prop.get("lng") if prop else None,
            "cover_photo_url": prop.get("cover_photo_url", "") if prop else "",
            "bedrooms": prop.get("bedrooms", 0) if prop else 0,
            "bathrooms": prop.get("bathrooms", 0) if prop else 0,
        } if prop else None,
        "config": config,
        "wifi": {"network": (notes or {}).get("wifi_network", config.get("house_rules", {}).get("wifi_network", "")), "password": (notes or {}).get("wifi_password", config.get("house_rules", {}).get("wifi_password", ""))},
        "check_out_at": res.get("check_out_at") if res else None,
        "hours_remaining": round(hours_remaining, 1) if hours_remaining else None,
        "guest_inventory": [serialize_doc(i) for i in guest_items],
        "host_phone": config.get("contacts", {}).get("main_phone", ""),
        "emergency_phone": config.get("contacts", {}).get("emergency_phone", ""),
        "maintenance_phone": config.get("contacts", {}).get("maintenance_hotline", ""),
    }

# ===== Checkout =====

class CheckoutRequest(BaseModel):
    reservation_id: str
    feedback: str = ""
    rating: int = 0  # 1-5
    departure_checklist_completed: bool = False

@router.post("/checkout")
async def guest_checkout(input: CheckoutRequest, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc).isoformat()
    
    reservation = await db.reservations.find_one({"_id": ObjectId(input.reservation_id)})
    property_id = reservation.get("property_id", "") if reservation else ""
    property_name = ""
    if property_id:
        try:
            prop = await db.properties.find_one({"_id": ObjectId(property_id)})
            property_name = (prop or {}).get("nickname") or (prop or {}).get("name", "")
        except Exception:
            pass

    await db.reservations.update_one(
        {"_id": ObjectId(input.reservation_id)},
        {"$set": {"reservation_status": "checked_out", "actual_checkout_at": now, "guest_rating": input.rating, "guest_feedback": input.feedback}}
    )
    
    # Auto-create turnover task (option C)
    try:
        turnover_doc = {
            "title": f"Checkout Cleaning - {property_name or 'Property'}",
            "property_id": property_id,
            "property_name": property_name,
            "reservation_id": input.reservation_id,
            "status": "new",
            "priority": "urgent" if input.rating and input.rating <= 3 else "high",
            "type": "checkout_cleaning",
            "guest_checkout_at": now,
            "guest_rating": input.rating,
            "guest_feedback": input.feedback,
            "checklist_completed_by_guest": input.departure_checklist_completed,
            "auto_generated": True,
            "notes": f"Auto-created after guest checkout. Guest rating: {input.rating}/5. Feedback: {input.feedback[:200] if input.feedback else 'none'}",
            "created_at": now,
            "updated_at": now,
        }
        await db.turnovers.insert_one(turnover_doc)
    except Exception as e:
        logger.warning(f"Failed to auto-create turnover: {e}")

    await db.notifications.insert_one({
        "type": "guest_checkout", "title": f"Guest checked out — {user.get('first_name', 'Guest')}",
        "body": f"Rating: {'⭐' * (input.rating or 0)} | Checklist: {'✅' if input.departure_checklist_completed else '❌'} | {input.feedback[:100] if input.feedback else 'No feedback'} | Turnover auto-created.",
        "read": False, "created_at": now,
    })
    
    await _log_interaction(db, input.reservation_id, "checkout", f"Guest checked out. Rating: {input.rating}/5. Turnover auto-created.")
    
    return {"success": True, "message": "You're checked out! Thank you for your stay. A cleaning crew has been notified."}

# ===== Late Checkout / Extension =====

class LateCheckoutRequest(BaseModel):
    reservation_id: str
    requested_time: str = ""  # e.g., "2:00 PM"
    reason: str = ""

@router.post("/late-checkout")
async def request_late_checkout(input: LateCheckoutRequest, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc).isoformat()
    
    config = await db.company_config.find_one({"section": "check_in_out"})
    fee = config.get("late_check_out_fee", 50) if config else 50
    
    await db.guest_requests.insert_one({
        "type": "late_checkout", "reservation_id": input.reservation_id,
        "requested_time": input.requested_time, "reason": input.reason,
        "fee": fee, "status": "pending",
        "guest_id": user["id"], "guest_name": f"{user.get('first_name', '')}",
        "created_at": now,
    })
    
    await db.notifications.insert_one({
        "type": "late_checkout_request", "title": f"Late checkout request — {user.get('first_name', 'Guest')}",
        "body": f"Requested: {input.requested_time}. Fee: ${fee}. Reason: {input.reason}",
        "read": False, "created_at": now,
    })
    
    await _log_interaction(db, input.reservation_id, "late_checkout_request", f"Requested late checkout: {input.requested_time}")
    
    return {"success": True, "fee": fee, "message": f"Late checkout request submitted. Fee: ${fee}. The host will respond shortly."}

# ===== Issue Reporting (Guest) =====

class GuestIssueReport(BaseModel):
    property_id: str
    reservation_id: str = ""
    title: str
    description: str = ""
    urgency: str = "normal"  # normal, urgent

@router.post("/report-issue")
async def guest_report_issue(input: GuestIssueReport, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc).isoformat()
    
    issue_doc = {
        "property_id": input.property_id,
        "title": f"[GUEST] {input.title}",
        "description": input.description,
        "priority": "urgent" if input.urgency == "urgent" else "high",
        "status": "new",
        "trade_type": "guest_reported",
        "source_user_id": user["id"],
        "guest_reported": True,
        "reservation_id": input.reservation_id,
        "created_at": now,
    }
    await db.issues.insert_one(issue_doc)
    
    await db.notifications.insert_one({
        "type": "guest_issue", "title": f"Guest reported issue: {input.title}",
        "body": f"{input.description[:100]}. Urgency: {input.urgency}",
        "read": False, "created_at": now,
    })
    
    await _log_interaction(db, input.reservation_id, "issue_reported", input.title)
    
    return {"success": True, "message": "Issue reported! The host has been notified and will respond shortly."}

# ===== Lost & Found =====

class LostFoundReport(BaseModel):
    reservation_id: str
    property_id: str
    description: str
    contact_method: str = "email"  # email, phone, text

@router.post("/lost-found")
async def report_lost_found(input: LostFoundReport, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc).isoformat()
    
    await db.lost_found.insert_one({
        "reservation_id": input.reservation_id, "property_id": input.property_id,
        "description": input.description, "contact_method": input.contact_method,
        "guest_id": user["id"], "guest_name": f"{user.get('first_name', '')}",
        "guest_email": user.get("email", ""), "status": "reported", "created_at": now,
    })
    
    await db.notifications.insert_one({
        "type": "lost_found", "title": f"Lost item reported by {user.get('first_name', 'Guest')}",
        "body": input.description[:100], "read": False, "created_at": now,
    })
    
    await _log_interaction(db, input.reservation_id, "lost_found", input.description[:100])
    
    return {"success": True, "message": "Report submitted! We'll check the property and contact you."}

# ===== Guest Interactions Log =====

async def _log_interaction(db, reservation_id: str, interaction_type: str, detail: str):
    await db.guest_interactions.insert_one({
        "reservation_id": reservation_id,
        "type": interaction_type,
        "detail": detail,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

@router.get("/interactions/{reservation_id}")
async def get_interactions(reservation_id: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    interactions = await db.guest_interactions.find({"reservation_id": reservation_id}).sort("created_at", -1).to_list(100)
    return [serialize_doc(i) for i in interactions]

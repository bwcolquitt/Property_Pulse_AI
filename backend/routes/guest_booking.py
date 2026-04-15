from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import serialize_doc
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/guest-booking", tags=["guest-booking"])

def get_db(request: Request):
    return request.app.state.db

class BookingRequest(BaseModel):
    property_id: str
    guest_name: str
    guest_email: str
    guest_phone: str = ""
    check_in_date: str  # YYYY-MM-DD
    check_out_date: str  # YYYY-MM-DD
    adults: int = 1
    children: int = 0
    infants: int = 0
    pets: bool = False
    special_requests: str = ""

@router.get("/properties")
async def list_available_properties(request: Request):
    """Public endpoint - no auth required. Lists properties available for booking."""
    db = get_db(request)
    properties = await db.properties.find({"status": "active"}).to_list(50)
    result = []
    for p in properties:
        doc = {
            "id": str(p["_id"]),
            "name": p.get("nickname", p.get("name", "")),
            "address": f"{p.get('city', '')}, {p.get('state', '')}",
            "property_type": p.get("property_type", ""),
            "bedrooms": p.get("bedrooms", 0),
            "bathrooms": p.get("bathrooms", 0),
            "sleeps": p.get("sleeps", 0),
            "cover_photo_url": p.get("cover_photo_url", ""),
        }
        # Get booked dates
        reservations = await db.reservations.find({
            "property_id": str(p["_id"]),
            "reservation_status": {"$in": ["confirmed", "pending"]}
        }).to_list(100)
        booked_dates = []
        for r in reservations:
            booked_dates.append({
                "check_in": r.get("check_in_at", "")[:10] if r.get("check_in_at") else "",
                "check_out": r.get("check_out_at", "")[:10] if r.get("check_out_at") else "",
            })
        doc["booked_dates"] = booked_dates
        result.append(doc)
    return result

@router.post("/book")
async def submit_booking(input: BookingRequest, request: Request):
    """Public endpoint - no auth required. Guests submit booking requests."""
    db = get_db(request)
    now = datetime.now(timezone.utc).isoformat()
    
    # Verify property exists
    prop = await db.properties.find_one({"_id": ObjectId(input.property_id)})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Check for date conflicts
    existing = await db.reservations.find({
        "property_id": input.property_id,
        "reservation_status": {"$in": ["confirmed", "pending"]},
    }).to_list(100)
    
    for r in existing:
        r_in = (r.get("check_in_at") or "")[:10]
        r_out = (r.get("check_out_at") or "")[:10]
        if r_in and r_out:
            if input.check_in_date < r_out and input.check_out_date > r_in:
                raise HTTPException(status_code=409, detail="Selected dates conflict with an existing reservation")
    
    guest_count = input.adults + input.children + input.infants
    
    # Create reservation
    reservation_doc = {
        "property_id": input.property_id,
        "source_system": "direct",
        "external_reservation_id": f"DIRECT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "guest_name": input.guest_name,
        "guest_email": input.guest_email,
        "guest_phone": input.guest_phone,
        "guest_count": guest_count,
        "adults": input.adults,
        "children": input.children,
        "infants": input.infants,
        "pets": input.pets,
        "check_in_at": f"{input.check_in_date}T15:00:00",
        "check_out_at": f"{input.check_out_date}T11:00:00",
        "reservation_status": "pending",
        "special_requests": input.special_requests,
        "booking_source": "guest_direct",
        "created_at": now,
    }
    result = await db.reservations.insert_one(reservation_doc)
    reservation_doc["id"] = str(result.inserted_id)
    reservation_doc.pop("_id", None)
    
    # Create notification for admin
    await db.notifications.insert_one({
        "type": "new_booking",
        "title": f"New direct booking request from {input.guest_name}",
        "body": f"{prop.get('nickname', prop.get('name', ''))} - {input.check_in_date} to {input.check_out_date} ({guest_count} guests)",
        "read": False,
        "created_at": now,
    })
    
    return {
        "success": True,
        "booking_id": reservation_doc["id"],
        "property_name": prop.get("nickname", prop.get("name", "")),
        "check_in": input.check_in_date,
        "check_out": input.check_out_date,
        "guest_count": guest_count,
        "status": "pending",
        "message": "Your booking request has been submitted! The property manager will confirm shortly."
    }

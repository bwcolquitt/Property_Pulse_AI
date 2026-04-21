from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reservations", tags=["reservations"])

def get_db(request: Request):
    return request.app.state.db

class ReservationSync(BaseModel):
    source_system: str  # airbnb, vrbo, booking, direct
    external_id: str = ""
    property_id: str
    guest_name: str
    check_in_at: str
    check_out_at: str
    guest_count: int = 1
    notes: str = ""

class SyncTrigger(BaseModel):
    source_system: str
    property_id: Optional[str] = None

@router.get("")
async def list_reservations(request: Request, property_id: Optional[str] = None, status: Optional[str] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    query = {}
    if property_id:
        query["property_id"] = property_id
    if status:
        query["reservation_status"] = status
    reservations = await db.reservations.find(query).sort("check_in_at", 1).to_list(200)
    result = []
    for r in reservations:
        doc = serialize_doc(r)
        if r.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(r["property_id"])})
                doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
                doc["property_address"] = f"{prop.get('address_1', '')}, {prop.get('city', '')}" if prop else ""
            except:
                doc["property_name"] = ""
                doc["property_address"] = ""
        result.append(doc)
    return result

@router.post("")
async def create_reservation(input: ReservationSync, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "property_id": input.property_id,
        "source_system": input.source_system,
        "external_reservation_id": input.external_id or f"MANUAL-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "guest_name": input.guest_name,
        "guest_count": input.guest_count,
        "check_in_at": input.check_in_at,
        "check_out_at": input.check_out_at,
        "reservation_status": "confirmed",
        "notes": input.notes,
        "synced_at": now,
        "created_at": now,
    }
    result = await db.reservations.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@router.post("/sync")
async def trigger_sync(input: SyncTrigger, request: Request):
    """Mock sync from external platforms (Airbnb/Vrbo/Booking)."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Generate mock reservations based on source
    mock_guests = [
        ("Emma & James Wilson", 4), ("The Rodriguez Family", 6),
        ("Michael Brown", 2), ("Sophie & Alex Turner", 3),
        ("The Patel Family", 5), ("Chris & Taylor Davis", 2),
    ]
    
    props = []
    if input.property_id:
        prop = await db.properties.find_one({"_id": ObjectId(input.property_id)})
        if prop:
            props = [prop]
    else:
        props = await db.properties.find({"status": "active"}).to_list(10)
    
    synced = []
    import random
    for i, prop in enumerate(props[:3]):
        guest = mock_guests[i % len(mock_guests)]
        check_in = today + timedelta(days=random.randint(5, 14), hours=15)
        check_out = check_in + timedelta(days=random.randint(2, 7))
        ext_id = f"{input.source_system.upper()}-SYNC-{now.strftime('%m%d')}-{i+1}"
        
        existing = await db.reservations.find_one({"external_reservation_id": ext_id})
        if existing:
            continue
        
        doc = {
            "property_id": str(prop["_id"]),
            "source_system": input.source_system,
            "external_reservation_id": ext_id,
            "guest_name": guest[0],
            "guest_count": guest[1],
            "check_in_at": check_in.isoformat(),
            "check_out_at": check_out.isoformat(),
            "reservation_status": "confirmed",
            "notes": f"Auto-synced from {input.source_system}",
            "synced_at": now.isoformat(),
            "created_at": now.isoformat(),
        }
        result = await db.reservations.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        synced.append(doc)
    
    return {"synced_count": len(synced), "source": input.source_system, "reservations": synced}

@router.delete("/{reservation_id}")
async def cancel_reservation(reservation_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    await db.reservations.update_one(
        {"_id": ObjectId(reservation_id)},
        {"$set": {"reservation_status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True}

@router.get("/stats")
async def reservation_stats(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    total = await db.reservations.count_documents({})
    upcoming = await db.reservations.count_documents({"check_in_at": {"$gte": today}, "reservation_status": "confirmed"})
    sources = {}
    all_res = await db.reservations.find({}).to_list(500)
    for r in all_res:
        src = r.get("source_system", "unknown")
        sources[src] = sources.get(src, 0) + 1
    
    return {"total": total, "upcoming": upcoming, "by_source": sources}

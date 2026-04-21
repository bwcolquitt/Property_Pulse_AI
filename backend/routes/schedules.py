from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone, timedelta
from bson import ObjectId

router = APIRouter(prefix="/api/schedules", tags=["schedules"])

def get_db(request: Request):
    return request.app.state.db

class RecurringScheduleCreate(BaseModel):
    property_id: str
    schedule_type: str  # cleaning, maintenance, pool, deep_clean, safety_check
    frequency: str  # daily, weekly, biweekly, monthly
    day_of_week: Optional[int] = None  # 0=Mon, 6=Sun
    preferred_time: str = "10:00"
    provider_id: Optional[str] = None
    notes: str = ""

class AvailabilityUpdate(BaseModel):
    date: str  # YYYY-MM-DD
    available: bool
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    notes: str = ""

@router.get("/recurring")
async def list_recurring(request: Request, property_id: Optional[str] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    query = {"active": True}
    if property_id: query["property_id"] = property_id
    schedules = await db.recurring_schedules.find(query).to_list(100)
    result = []
    for s in schedules:
        doc = serialize_doc(s)
        if s.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(s["property_id"])})
                doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
            except: doc["property_name"] = ""
        if s.get("provider_id"):
            try:
                prov = await db.providers.find_one({"_id": ObjectId(s["provider_id"])})
                doc["provider_name"] = prov.get("company_name", "") if prov else "Unassigned"
            except: doc["provider_name"] = "Unassigned"
        else:
            doc["provider_name"] = "Unassigned"
        result.append(doc)
    return result

@router.post("/recurring")
async def create_recurring(input: RecurringScheduleCreate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **input.dict(),
        "active": True,
        "last_generated": None,
        "created_by": user["id"],
        "created_at": now,
    }
    result = await db.recurring_schedules.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@router.delete("/recurring/{schedule_id}")
async def delete_recurring(schedule_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    await db.recurring_schedules.update_one({"_id": ObjectId(schedule_id)}, {"$set": {"active": False}})
    return {"success": True}

@router.get("/provider-availability/{provider_id}")
async def get_availability(provider_id: str, request: Request, month: Optional[str] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    query = {"provider_id": provider_id}
    if month: query["date"] = {"$regex": f"^{month}"}
    avail = await db.provider_availability.find(query).sort("date", 1).to_list(100)
    return serialize_doc(avail)

@router.put("/provider-availability/{provider_id}")
async def update_availability(provider_id: str, input: AvailabilityUpdate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    await db.provider_availability.update_one(
        {"provider_id": provider_id, "date": input.date},
        {"$set": {"provider_id": provider_id, "date": input.date, "available": input.available, "start_time": input.start_time, "end_time": input.end_time, "notes": input.notes, "updated_at": now}},
        upsert=True
    )
    return {"success": True}

@router.get("/provider-availability-bulk")
async def bulk_availability(request: Request, month: Optional[str] = None):
    """Get availability for all providers for calendar view."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    providers = await db.providers.find({"profile_status": "active"}).to_list(50)
    result = []
    for p in providers:
        pid = str(p["_id"])
        query = {"provider_id": pid}
        if month: query["date"] = {"$regex": f"^{month}"}
        avail = await db.provider_availability.find(query).to_list(60)
        result.append({
            "provider_id": pid,
            "company_name": p.get("company_name", ""),
            "provider_type": p.get("provider_type", ""),
            "availability": serialize_doc(avail),
        })
    return result

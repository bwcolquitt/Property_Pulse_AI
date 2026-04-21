from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/property-notes", tags=["property-notes"])

def get_db(request: Request):
    return request.app.state.db

class ServiceNotes(BaseModel):
    property_id: str
    garage_code: str = ""
    front_door_code: str = ""
    lockbox_code: str = ""
    gate_code: str = ""
    owner_storage_code: str = ""
    alarm_code: str = ""
    wifi_network: str = ""
    wifi_password: str = ""
    pool_pump_location: str = ""
    breaker_panel_location: str = ""
    water_shutoff_location: str = ""
    trash_day: str = ""
    special_instructions: str = ""
    custom_notes: List[dict] = []  # [{label, value}]

@router.get("/{property_id}")
async def get_property_notes(property_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    notes = await db.property_service_notes.find_one({"property_id": property_id})
    if not notes:
        return {"property_id": property_id}
    return serialize_doc(notes)

@router.put("/{property_id}")
async def update_property_notes(property_id: str, input: ServiceNotes, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    doc = input.dict()
    doc["updated_by"] = user["id"]
    doc["updated_at"] = now
    await db.property_service_notes.update_one({"property_id": property_id}, {"$set": doc}, upsert=True)
    return {"success": True}

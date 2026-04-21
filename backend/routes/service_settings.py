from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/service-settings", tags=["service-settings"])

def get_db(request: Request):
    return request.app.state.db

class ServiceSettingUpdate(BaseModel):
    hourly_rate: Optional[float] = None
    emergency_rate: Optional[float] = None
    materials_markup: Optional[float] = None
    minimum_charge: Optional[float] = None
    travel_fee: Optional[float] = None
    company_name: Optional[str] = None
    notes: Optional[str] = None

class PropertyServiceConfig(BaseModel):
    property_id: str
    services: list  # ["cleaning", "maintenance", "pool", "electrical", ...]

@router.get("/property-services/{property_id}")
async def get_property_services(property_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    config = await db.property_service_configs.find_one({"property_id": property_id})
    if not config:
        return {"property_id": property_id, "services": ["cleaning", "maintenance"]}
    return serialize_doc(config)

@router.put("/property-services")
async def update_property_services(input: PropertyServiceConfig, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") not in ["property_manager", "super_admin", "operations_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    now = datetime.now(timezone.utc).isoformat()
    await db.property_service_configs.update_one(
        {"property_id": input.property_id},
        {"$set": {"property_id": input.property_id, "services": input.services, "updated_at": now}},
        upsert=True
    )
    return {"success": True, "property_id": input.property_id, "services": input.services}

@router.get("")
async def list_settings(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    settings = await db.service_company_settings.find().to_list(50)
    return serialize_doc(settings)

@router.put("/{trade_type}")
async def update_setting(trade_type: str, input: ServiceSettingUpdate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") not in ["property_manager", "super_admin", "operations_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field, value in input.dict(exclude_unset=True).items():
        if value is not None:
            update[field] = value
    result = await db.service_company_settings.update_one({"trade_type": trade_type}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Setting not found")
    updated = await db.service_company_settings.find_one({"trade_type": trade_type})
    return serialize_doc(updated)

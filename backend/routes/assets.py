from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/assets", tags=["assets"])

def get_db(request: Request):
    return request.app.state.db

class AssetCreate(BaseModel):
    property_id: str
    name: str
    category: str = "appliance"  # appliance, furniture, fixture, electronics, outdoor
    manufacturer: str = ""
    model_number: str = ""
    serial_number: str = ""
    purchase_date: Optional[str] = None
    install_date: Optional[str] = None
    warranty_expiry: Optional[str] = None
    purchase_price: Optional[float] = None
    location_in_property: str = ""
    condition: str = "good"  # new, good, fair, poor, needs_replacement
    notes: str = ""

class AssetUpdate(BaseModel):
    condition: Optional[str] = None
    notes: Optional[str] = None
    warranty_expiry: Optional[str] = None
    location_in_property: Optional[str] = None

@router.get("")
async def list_assets(request: Request, property_id: Optional[str] = None, category: Optional[str] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    query = {"active": True}
    if property_id:
        query["property_id"] = property_id
    if category:
        query["category"] = category
    assets = await db.property_assets.find(query).sort("name", 1).to_list(200)
    result = []
    for a in assets:
        doc = serialize_doc(a)
        if a.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(a["property_id"])})
                doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
            except:
                doc["property_name"] = ""
        # Check warranty status
        if a.get("warranty_expiry"):
            try:
                exp = datetime.fromisoformat(a["warranty_expiry"].replace("Z", "+00:00"))
                doc["warranty_active"] = exp > datetime.now(timezone.utc)
                days_left = (exp - datetime.now(timezone.utc)).days
                doc["warranty_days_left"] = max(0, days_left)
            except:
                doc["warranty_active"] = False
                doc["warranty_days_left"] = 0
        else:
            doc["warranty_active"] = False
            doc["warranty_days_left"] = 0
        result.append(doc)
    return result

@router.post("")
async def create_asset(input: AssetCreate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **input.dict(),
        "active": True,
        "maintenance_history": [],
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    result = await db.property_assets.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@router.put("/{asset_id}")
async def update_asset(asset_id: str, input: AssetUpdate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    updates = {k: v for k, v in input.dict().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.property_assets.update_one({"_id": ObjectId(asset_id)}, {"$set": updates})
    asset = await db.property_assets.find_one({"_id": ObjectId(asset_id)})
    return serialize_doc(asset)

@router.delete("/{asset_id}")
async def delete_asset(asset_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    await db.property_assets.update_one({"_id": ObjectId(asset_id)}, {"$set": {"active": False}})
    return {"success": True}

@router.get("/expiring-warranties")
async def expiring_warranties(request: Request, days: int = 30):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc)
    cutoff = (now + __import__('datetime').timedelta(days=days)).isoformat()
    assets = await db.property_assets.find({
        "active": True,
        "warranty_expiry": {"$lte": cutoff, "$gte": now.isoformat()}
    }).to_list(50)
    result = []
    for a in assets:
        doc = serialize_doc(a)
        if a.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(a["property_id"])})
                doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
            except:
                doc["property_name"] = ""
        result.append(doc)
    return result

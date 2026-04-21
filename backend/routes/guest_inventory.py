from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/guest-inventory", tags=["guest-inventory"])

def get_db(request: Request):
    return request.app.state.db

class GuestItem(BaseModel):
    property_id: str
    name: str
    category: str = "general"
    location: str = ""
    replacement_cost: float = 0
    quantity: int = 1
    notes: str = ""

@router.get("/{property_id}")
async def get_guest_inventory(property_id: str, request: Request):
    """Public - no auth. Guest-visible inventory with replacement charges."""
    db = get_db(request)
    items = await db.guest_inventory.find({"property_id": property_id, "active": True}).sort("category", 1).to_list(200)
    prop = await db.properties.find_one({"_id": ObjectId(property_id)})
    prop_name = prop.get("nickname", prop.get("name", "")) if prop else ""
    total = sum(i.get("replacement_cost", 0) * i.get("quantity", 1) for i in items)
    result = [serialize_doc(i) for i in items]
    return {"property_name": prop_name, "items": result, "total_value": total}

@router.post("")
async def add_guest_item(input: GuestItem, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    doc = {**input.dict(), "active": True, "created_by": user["id"], "created_at": now}
    result = await db.guest_inventory.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@router.delete("/{item_id}")
async def remove_guest_item(item_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    await db.guest_inventory.update_one({"_id": ObjectId(item_id)}, {"$set": {"active": False}})
    return {"success": True}

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

def get_db(request: Request):
    return request.app.state.db

class SupplyRequestCreate(BaseModel):
    property_id: str
    turnover_id: Optional[str] = None
    items: list  # [{"inventory_item_id": str, "requested_qty": int}]
    notes: str = ""

@router.get("")
async def list_inventory(request: Request, property_id: Optional[str] = None, low_stock: Optional[bool] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    query = {"active": True}
    if property_id:
        query["property_id"] = property_id
    items = await db.inventory_items.find(query).to_list(200)
    result = []
    for item in items:
        doc = serialize_doc(item)
        # Get current level
        level = await db.inventory_levels.find_one({"inventory_item_id": str(item["_id"])})
        doc["quantity_on_hand"] = level.get("quantity_on_hand", 0) if level else 0
        doc["last_counted_at"] = level.get("last_counted_at", "") if level else ""
        doc["is_low_stock"] = doc["quantity_on_hand"] <= item.get("reorder_level", 0)
        if low_stock and not doc["is_low_stock"]:
            continue
        # Get property name
        if item.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(item["property_id"])})
                doc["property_name"] = prop.get("name", "") if prop else ""
            except Exception:
                doc["property_name"] = ""
        result.append(doc)
    return result

@router.get("/supply-requests")
async def list_supply_requests(request: Request, status: Optional[str] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    query = {}
    if status:
        query["status"] = status
    requests_list = await db.supply_requests.find(query).sort("requested_at", -1).to_list(100)
    result = []
    for sr in requests_list:
        doc = serialize_doc(sr)
        if sr.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(sr["property_id"])})
                doc["property_name"] = prop.get("name", "") if prop else ""
            except Exception:
                doc["property_name"] = ""
        # Get items
        sr_items = await db.supply_request_items.find({"supply_request_id": str(sr["_id"])}).to_list(50)
        enriched_items = []
        for sri in sr_items:
            sid = serialize_doc(sri)
            if sri.get("inventory_item_id"):
                inv = await db.inventory_items.find_one({"_id": ObjectId(sri["inventory_item_id"])})
                sid["item_name"] = inv.get("name", "") if inv else ""
            enriched_items.append(sid)
        doc["items"] = enriched_items
        result.append(doc)
    return result

@router.post("/supply-requests")
async def create_supply_request(input: SupplyRequestCreate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "property_id": input.property_id,
        "turnover_id": input.turnover_id,
        "requested_by_user_id": user["id"],
        "status": "pending",
        "requested_at": now,
        "approved_at": None,
        "fulfilled_at": None,
        "notes": input.notes,
    }
    result = await db.supply_requests.insert_one(doc)
    sr_id = str(result.inserted_id)
    # Insert items
    for item in input.items:
        await db.supply_request_items.insert_one({
            "supply_request_id": sr_id,
            "inventory_item_id": item.get("inventory_item_id", ""),
            "requested_qty": item.get("requested_qty", 1),
            "approved_qty": None,
            "fulfilled_qty": None,
        })
    doc["id"] = sr_id
    return doc

@router.put("/supply-requests/{request_id}/approve")
async def approve_supply_request(request_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    await db.supply_requests.update_one({"_id": ObjectId(request_id)}, {"$set": {"status": "approved", "approved_at": now}})
    # Set approved_qty = requested_qty for all items
    items = await db.supply_request_items.find({"supply_request_id": request_id}).to_list(50)
    for item in items:
        await db.supply_request_items.update_one({"_id": item["_id"]}, {"$set": {"approved_qty": item.get("requested_qty", 0)}})
    return {"success": True}

@router.put("/supply-requests/{request_id}/fulfill")
async def fulfill_supply_request(request_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    await db.supply_requests.update_one({"_id": ObjectId(request_id)}, {"$set": {"status": "fulfilled", "fulfilled_at": now}})
    # Update inventory levels
    items = await db.supply_request_items.find({"supply_request_id": request_id}).to_list(50)
    for item in items:
        qty = item.get("approved_qty") or item.get("requested_qty", 0)
        await db.supply_request_items.update_one({"_id": item["_id"]}, {"$set": {"fulfilled_qty": qty}})
        # Increase inventory
        sr = await db.supply_requests.find_one({"_id": ObjectId(request_id)})
        if sr and item.get("inventory_item_id"):
            await db.inventory_levels.update_one(
                {"inventory_item_id": item["inventory_item_id"]},
                {"$inc": {"quantity_on_hand": qty}, "$set": {"last_counted_at": now}},
                upsert=True
            )
    return {"success": True}

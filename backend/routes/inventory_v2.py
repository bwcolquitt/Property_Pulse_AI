from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId
import qrcode
import io
import base64
import json

router = APIRouter(prefix="/api/inventory-v2", tags=["inventory-v2"])

def get_db(request: Request):
    return request.app.state.db

class InventoryItemCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    category: str = "general"
    unit_type: str = "each"
    par_level: int = 10
    reorder_level: int = 3
    location: str = ""  # e.g., "Storage Shed A"
    storage_area: str = ""  # e.g., "Shelf 2, Bin 4"
    property_id: Optional[str] = None
    allow_user_add: bool = False  # Can cleaners/maintenance add stock?
    qr_code_external: Optional[str] = None  # Third-party QR code ID
    reorder_url: Optional[str] = None  # External vendor link (e.g., Amazon)

class InventoryAdjust(BaseModel):
    item_id: str
    quantity: int  # positive = add, negative = remove
    reason: str = ""
    scanned_qr: Optional[str] = None

class QRAssociate(BaseModel):
    item_id: str
    external_qr_code: str

def generate_qr_base64(data: str, inverted: bool = True) -> str:
    """Generate an inverted QR code (white modules on dark navy background)."""
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    if inverted:
        img = qr.make_image(fill_color="white", back_color="#0A4F7F")
    else:
        img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()

@router.get("/items")
async def list_inventory_items(request: Request, property_id: Optional[str] = None, category: Optional[str] = None, low_stock: Optional[bool] = None, location: Optional[str] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    query = {"active": True}
    if property_id:
        query["property_id"] = property_id
    if category:
        query["category"] = category
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    items = await db.inventory_items_v2.find(query).sort("name", 1).to_list(500)
    result = []
    for item in items:
        doc = serialize_doc(item)
        doc["is_low_stock"] = doc.get("quantity_on_hand", 0) <= item.get("reorder_level", 0)
        if low_stock and not doc["is_low_stock"]:
            continue
        if item.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(item["property_id"])})
                doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
            except Exception:
                doc["property_name"] = ""
        result.append(doc)
    return result

@router.get("/items/{item_id}")
async def get_item(item_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    item = await db.inventory_items_v2.find_one({"_id": ObjectId(item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    doc = serialize_doc(item)
    # Get transaction history
    history = await db.inventory_transactions.find({"item_id": item_id}).sort("created_at", -1).limit(20).to_list(20)
    doc["transactions"] = serialize_doc(history)
    return doc

@router.post("/items")
async def create_item(input: InventoryItemCreate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    # Only admins/managers can create items
    if user.get("role") not in ["property_manager", "super_admin", "operations_manager"]:
        raise HTTPException(status_code=403, detail="Only admins can create inventory items")
    item_id = ObjectId()
    qr_data = json.dumps({"type": "inventory", "id": str(item_id), "name": input.name, "sku": input.sku or ""})
    qr_base64 = generate_qr_base64(qr_data, inverted=True)
    doc = {
        "_id": item_id,
        **input.dict(),
        "quantity_on_hand": 0,
        "qr_code_data": qr_data,
        "qr_code_base64": qr_base64,
        "active": True,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.inventory_items_v2.insert_one(doc)
    doc_resp = serialize_doc(doc)
    doc_resp.pop("qr_code_base64", None)  # Don't return base64 in list
    return doc_resp

@router.get("/items/{item_id}/qr")
async def get_item_qr(item_id: str, request: Request):
    db = get_db(request)
    item = await db.inventory_items_v2.find_one({"_id": ObjectId(item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    qr_b64 = item.get("qr_code_base64")
    if not qr_b64:
        qr_data = json.dumps({"type": "inventory", "id": item_id, "name": item.get("name", "")})
        qr_b64 = generate_qr_base64(qr_data, inverted=True)
        await db.inventory_items_v2.update_one({"_id": ObjectId(item_id)}, {"$set": {"qr_code_base64": qr_b64, "qr_code_data": qr_data}})
    return {"qr_code_base64": qr_b64, "item_name": item.get("name", ""), "sku": item.get("sku", ""), "location": item.get("location", "")}

@router.post("/adjust")
async def adjust_inventory(input: InventoryAdjust, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    item = await db.inventory_items_v2.find_one({"_id": ObjectId(input.item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    # Check permissions
    is_admin = user.get("role") in ["property_manager", "super_admin", "operations_manager"]
    is_adding = input.quantity > 0
    if is_adding and not is_admin and not item.get("allow_user_add", False):
        raise HTTPException(status_code=403, detail="You don't have permission to add stock for this item")
    new_qty = max(0, item.get("quantity_on_hand", 0) + input.quantity)
    now = datetime.now(timezone.utc).isoformat()
    await db.inventory_items_v2.update_one({"_id": ObjectId(input.item_id)}, {"$set": {"quantity_on_hand": new_qty, "updated_at": now}})
    # Record transaction
    await db.inventory_transactions.insert_one({
        "item_id": input.item_id,
        "item_name": item.get("name", ""),
        "user_id": user["id"],
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
        "quantity_change": input.quantity,
        "new_quantity": new_qty,
        "reason": input.reason,
        "scanned_qr": input.scanned_qr,
        "action": "add" if input.quantity > 0 else "remove",
        "created_at": now,
    })
    return {"item_id": input.item_id, "name": item.get("name", ""), "previous_qty": item.get("quantity_on_hand", 0), "change": input.quantity, "new_qty": new_qty}

@router.post("/scan")
async def scan_qr_lookup(request: Request):
    """Look up an item by QR code data (scanned or external ID)."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    body = await request.json()
    qr_data = body.get("qr_data", "")
    # Try to parse as JSON (app-generated QR)
    try:
        parsed = json.loads(qr_data)
        if parsed.get("type") == "inventory" and parsed.get("id"):
            item = await db.inventory_items_v2.find_one({"_id": ObjectId(parsed["id"])})
            if item:
                return serialize_doc(item)
    except (json.JSONDecodeError, Exception):
        pass
    # Try external QR code lookup
    item = await db.inventory_items_v2.find_one({"qr_code_external": qr_data})
    if item:
        return serialize_doc(item)
    # Try SKU lookup
    item = await db.inventory_items_v2.find_one({"sku": qr_data})
    if item:
        return serialize_doc(item)
    raise HTTPException(status_code=404, detail="Item not found for this QR code")

@router.put("/items/{item_id}/associate-qr")
async def associate_external_qr(item_id: str, input: QRAssociate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") not in ["property_manager", "super_admin", "operations_manager"]:
        raise HTTPException(status_code=403, detail="Only admins can associate QR codes")
    await db.inventory_items_v2.update_one({"_id": ObjectId(item_id)}, {"$set": {"qr_code_external": input.external_qr_code, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"success": True}

@router.get("/locations")
async def list_locations(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    items = await db.inventory_items_v2.find({"active": True}).to_list(500)
    locations = {}
    for item in items:
        loc = item.get("location", "Unassigned")
        if loc not in locations:
            locations[loc] = {"name": loc, "item_count": 0, "low_stock_count": 0}
        locations[loc]["item_count"] += 1
        if item.get("quantity_on_hand", 0) <= item.get("reorder_level", 0):
            locations[loc]["low_stock_count"] += 1
    return list(locations.values())

@router.get("/categories")
async def list_categories(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    pipeline = [{"$match": {"active": True}}, {"$group": {"_id": "$category", "count": {"$sum": 1}}}]
    result = await db.inventory_items_v2.aggregate(pipeline).to_list(50)
    return [{"category": r["_id"], "count": r["count"]} for r in result]


class UpdateReorderUrl(BaseModel):
    reorder_url: str = ""
    reorder_level: Optional[int] = None

@router.put("/items/{item_id}/reorder-settings")
async def update_reorder_settings(item_id: str, input: UpdateReorderUrl, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if input.reorder_url is not None:
        updates["reorder_url"] = input.reorder_url
    if input.reorder_level is not None:
        updates["reorder_level"] = input.reorder_level
    await db.inventory_items_v2.update_one({"_id": ObjectId(item_id)}, {"$set": updates})
    return {"success": True}

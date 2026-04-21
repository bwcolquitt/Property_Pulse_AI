from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/supply-requests", tags=["supply-requests"])

def get_db(request: Request):
    return request.app.state.db

class SupplyRequestCreate(BaseModel):
    property_id: str
    items: List[dict]  # [{name, quantity, category, notes}]
    urgency: str = "normal"  # normal, urgent
    notes: str = ""

class SupplyRequestAction(BaseModel):
    action: str  # approve, reject, fulfill
    notes: str = ""

@router.get("")
async def list_requests(request: Request, status: Optional[str] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    query = {}
    if status:
        query["status"] = status
    requests = await db.supply_requests.find(query).sort("created_at", -1).to_list(100)
    result = []
    for r in requests:
        doc = serialize_doc(r)
        if r.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(r["property_id"])})
                doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
            except:
                doc["property_name"] = ""
        result.append(doc)
    return result

@router.post("")
async def create_request(input: SupplyRequestCreate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    total_items = sum(i.get("quantity", 1) for i in input.items)
    doc = {
        "property_id": input.property_id,
        "items": input.items,
        "total_items": total_items,
        "urgency": input.urgency,
        "notes": input.notes,
        "status": "pending",
        "requested_by": user["id"],
        "requested_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
        "approved_by": None,
        "fulfilled_at": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.supply_requests.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@router.put("/{request_id}")
async def action_request(request_id: str, input: SupplyRequestAction, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    
    updates = {"updated_at": now}
    if input.action == "approve":
        updates["status"] = "approved"
        updates["approved_by"] = user["id"]
        updates["approval_notes"] = input.notes
    elif input.action == "reject":
        updates["status"] = "rejected"
        updates["rejection_notes"] = input.notes
    elif input.action == "fulfill":
        updates["status"] = "fulfilled"
        updates["fulfilled_at"] = now
        updates["fulfillment_notes"] = input.notes
        # Update inventory quantities
        sr = await db.supply_requests.find_one({"_id": ObjectId(request_id)})
        if sr:
            for item in sr.get("items", []):
                name = item.get("name", "")
                qty = item.get("quantity", 0)
                inv = await db.inventory_items_v2.find_one({"name": {"$regex": name, "$options": "i"}, "active": True})
                if inv:
                    await db.inventory_items_v2.update_one(
                        {"_id": inv["_id"]},
                        {"$inc": {"quantity_on_hand": qty}}
                    )
    
    await db.supply_requests.update_one({"_id": ObjectId(request_id)}, {"$set": updates})
    return {"success": True}

@router.get("/stats")
async def request_stats(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    pending = await db.supply_requests.count_documents({"status": "pending"})
    approved = await db.supply_requests.count_documents({"status": "approved"})
    fulfilled = await db.supply_requests.count_documents({"status": "fulfilled"})
    return {"pending": pending, "approved": approved, "fulfilled": fulfilled, "total": pending + approved + fulfilled}

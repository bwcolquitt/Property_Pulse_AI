from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId
import os, logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/onsite-purchases", tags=["onsite-purchases"])

def get_db(request: Request):
    return request.app.state.db

class PurchaseCreate(BaseModel):
    property_id: str
    turnover_id: Optional[str] = None
    item_name: str
    quantity: int = 1
    unit_cost: float = 0
    receipt_photo_base64: str = ""
    notes: str = ""

MARKUP_RATE = 0.25  # 25% service fee

@router.post("")
async def create_purchase(input: PurchaseCreate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    subtotal = input.unit_cost * input.quantity
    service_fee = round(subtotal * MARKUP_RATE, 2)
    total = round(subtotal + service_fee, 2)
    doc = {
        "property_id": input.property_id,
        "turnover_id": input.turnover_id,
        "item_name": input.item_name,
        "quantity": input.quantity,
        "unit_cost": input.unit_cost,
        "subtotal": subtotal,
        "service_fee_rate": MARKUP_RATE,
        "service_fee": service_fee,
        "total": total,
        "receipt_photo": input.receipt_photo_base64[:100] + "..." if len(input.receipt_photo_base64) > 100 else input.receipt_photo_base64,
        "has_receipt": bool(input.receipt_photo_base64),
        "notes": input.notes,
        "status": "pending_approval",
        "submitted_by": user["id"],
        "submitted_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
        "created_at": now,
    }
    result = await db.onsite_purchases.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return {**doc, "ai_breakdown": {"subtotal": subtotal, "service_fee_25_pct": service_fee, "total_to_admin": total}}

@router.get("")
async def list_purchases(request: Request, status: Optional[str] = None, property_id: Optional[str] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    query = {}
    if status: query["status"] = status
    if property_id: query["property_id"] = property_id
    purchases = await db.onsite_purchases.find(query).sort("created_at", -1).to_list(100)
    result = []
    for p in purchases:
        doc = serialize_doc(p)
        if p.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(p["property_id"])})
                doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
            except: doc["property_name"] = ""
        result.append(doc)
    return result

class PurchaseAction(BaseModel):
    action: str  # approve, reject

@router.put("/{purchase_id}")
async def action_purchase(purchase_id: str, input: PurchaseAction, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    updates = {"status": "approved" if input.action == "approve" else "rejected", "actioned_by": user["id"], "actioned_at": now}
    await db.onsite_purchases.update_one({"_id": ObjectId(purchase_id)}, {"$set": updates})
    return {"success": True}

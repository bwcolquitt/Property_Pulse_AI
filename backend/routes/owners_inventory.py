"""Owners Inventory - Track storage boxes & owner-only items with QR codes.

Separate from guest_inventory (which lists items guests can damage).
This is for the owner's personal belongings kept on-site (storage boxes,
locked closets, seasonal gear).
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId
import secrets

router = APIRouter(prefix="/api/owners-inventory", tags=["owners-inventory"])

def get_db(request: Request):
    return request.app.state.db

class StorageBoxInput(BaseModel):
    property_id: str
    label: str  # e.g., "Beach Gear Box", "Holiday Decor"
    location: str = ""  # e.g., "Garage Shelf 2", "Owner's Closet"
    access_notes: str = ""  # key location, combo, etc.
    owner_only: bool = True
    contents: List[str] = []  # list of items in the box
    photo_url: str = ""

@router.post("")
async def create_storage_box(input: StorageBoxInput, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    now = datetime.now(timezone.utc).isoformat()
    qr_code = f"OWN-{secrets.token_urlsafe(8).upper()}"
    doc = {
        **input.dict(),
        "qr_code": qr_code,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
        "active": True,
    }
    res = await db.owners_inventory.insert_one(doc)
    return {"success": True, "id": str(res.inserted_id), "qr_code": qr_code}

@router.get("")
async def list_storage_boxes(request: Request, property_id: Optional[str] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    q = {"active": True}
    if property_id:
        q["property_id"] = property_id
    boxes = await db.owners_inventory.find(q).sort("created_at", -1).to_list(500)
    # Enrich with property name
    out = []
    for b in boxes:
        d = serialize_doc(b)
        if b.get("property_id"):
            try:
                p = await db.properties.find_one({"_id": ObjectId(b["property_id"])})
                if p:
                    d["property_name"] = p.get("nickname") or p.get("name", "")
            except Exception:
                pass
        out.append(d)
    return out

@router.get("/qr/{qr_code}")
async def scan_qr(qr_code: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    box = await db.owners_inventory.find_one({"qr_code": qr_code, "active": True})
    if not box:
        raise HTTPException(404, "Storage box not found")
    return serialize_doc(box)

class UpdateBox(BaseModel):
    label: Optional[str] = None
    location: Optional[str] = None
    access_notes: Optional[str] = None
    contents: Optional[List[str]] = None
    photo_url: Optional[str] = None

@router.put("/{box_id}")
async def update_box(box_id: str, input: UpdateBox, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    updates = {k: v for k, v in input.dict(exclude_unset=True).items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.owners_inventory.update_one({"_id": ObjectId(box_id)}, {"$set": updates})
    return {"success": True}

@router.delete("/{box_id}")
async def delete_box(box_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    await db.owners_inventory.update_one({"_id": ObjectId(box_id)}, {"$set": {"active": False}})
    return {"success": True}

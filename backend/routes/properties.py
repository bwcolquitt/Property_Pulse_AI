from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/properties", tags=["properties"])

def get_db(request: Request):
    return request.app.state.db

class PropertyCreate(BaseModel):
    name: str
    code: str = ""
    address_1: str = ""
    city: str = ""
    state: str = ""
    postal_code: str = ""
    country: str = "US"
    property_type: str = "vacation_rental"
    bedrooms: int = 1
    bathrooms: int = 1
    sleeps: int = 2
    cover_photo_url: str = ""

@router.get("")
async def list_properties(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    props = await db.properties.find().to_list(100)
    # Enrich with counts
    result = []
    for p in props:
        pid = str(p["_id"])
        open_issues = await db.issues.count_documents({"property_id": pid, "status": {"$nin": ["completed", "cancelled"]}})
        open_turnovers = await db.turnovers.count_documents({"property_id": pid, "status": {"$nin": ["completed"]}})
        doc = serialize_doc(p)
        doc["open_issues"] = open_issues
        doc["open_turnovers"] = open_turnovers
        result.append(doc)
    return result

@router.get("/{property_id}")
async def get_property(property_id: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    prop = await db.properties.find_one({"_id": ObjectId(property_id)})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    doc = serialize_doc(prop)
    doc["open_issues"] = await db.issues.count_documents({"property_id": property_id, "status": {"$nin": ["completed", "cancelled"]}})
    doc["turnovers"] = serialize_doc(await db.turnovers.find({"property_id": property_id}).sort("due_at", -1).limit(10).to_list(10))
    doc["issues"] = serialize_doc(await db.issues.find({"property_id": property_id}).sort("created_at", -1).limit(10).to_list(10))
    access = await db.property_access.find_one({"property_id": property_id}, {"_id": 0})
    doc["access"] = access or {}
    return doc

@router.post("")
async def create_property(input: PropertyCreate, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    doc = {
        **input.dict(),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.properties.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc

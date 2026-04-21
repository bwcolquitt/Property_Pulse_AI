from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/improvements", tags=["improvements"])

def get_db(request: Request):
    return request.app.state.db

class ImprovementCreate(BaseModel):
    property_id: str
    turnover_id: Optional[str] = None
    title: str
    description: str = ""
    location: str = ""
    photo_base64: str = ""
    priority: str = "nice_to_have"  # nice_to_have, recommended, high_impact

@router.get("")
async def list_improvements(request: Request, property_id: Optional[str] = None, status: Optional[str] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    query = {}
    if property_id: query["property_id"] = property_id
    if status: query["status"] = status
    items = await db.improvements.find(query).sort("created_at", -1).to_list(100)
    result = []
    for i in items:
        doc = serialize_doc(i)
        if i.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(i["property_id"])})
                doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
            except: doc["property_name"] = ""
        result.append(doc)
    return result

@router.post("")
async def create_improvement(input: ImprovementCreate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **input.dict(),
        "has_photo": bool(input.photo_base64),
        "photo": input.photo_base64[:100] + "..." if len(input.photo_base64) > 100 else input.photo_base64,
        "status": "suggested",
        "reported_by": user["id"],
        "reported_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
        "created_at": now,
    }
    result = await db.improvements.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

class ImprovementAction(BaseModel):
    action: str  # approve, dismiss, complete

@router.put("/{improvement_id}")
async def action_improvement(improvement_id: str, input: ImprovementAction, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    status_map = {"approve": "approved", "dismiss": "dismissed", "complete": "completed"}
    await db.improvements.update_one({"_id": ObjectId(improvement_id)}, {"$set": {"status": status_map.get(input.action, "suggested"), "actioned_at": datetime.now(timezone.utc).isoformat()}})
    return {"success": True}

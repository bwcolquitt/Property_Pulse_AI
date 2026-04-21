from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/inspections", tags=["inspections"])

def get_db(request: Request):
    return request.app.state.db

class InspectionCreate(BaseModel):
    property_id: str
    turnover_id: Optional[str] = None
    due_at: Optional[str] = None

class InspectionItemUpdate(BaseModel):
    status: str  # pass, fail, pending
    note: str = ""

@router.get("")
async def list_inspections(request: Request, status: Optional[str] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    query = {}
    if status:
        query["status"] = status
    inspections = await db.inspections.find(query).sort("due_at", 1).to_list(100)
    result = []
    for insp in inspections:
        doc = serialize_doc(insp)
        if insp.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(insp["property_id"])})
                doc["property_name"] = prop.get("name", "") if prop else ""
            except Exception:
                doc["property_name"] = ""
        if insp.get("assigned_inspector_id"):
            try:
                inspector = await db.users.find_one({"_id": ObjectId(insp["assigned_inspector_id"])})
                doc["inspector_name"] = f"{inspector.get('first_name', '')} {inspector.get('last_name', '')}" if inspector else "Unassigned"
            except Exception:
                doc["inspector_name"] = "Unassigned"
        else:
            doc["inspector_name"] = "Unassigned"
        # Count items
        items = await db.inspection_items.find({"inspection_id": str(insp["_id"])}).to_list(100)
        doc["total_items"] = len(items)
        doc["passed_items"] = sum(1 for i in items if i.get("status") == "pass")
        doc["failed_items"] = sum(1 for i in items if i.get("status") == "fail")
        result.append(doc)
    return result

@router.get("/{inspection_id}")
async def get_inspection(inspection_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    insp = await db.inspections.find_one({"_id": ObjectId(inspection_id)})
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    doc = serialize_doc(insp)
    if insp.get("property_id"):
        try:
            prop = await db.properties.find_one({"_id": ObjectId(insp["property_id"])})
            doc["property"] = serialize_doc(prop) if prop else None
        except Exception:
            doc["property"] = None
    items = await db.inspection_items.find({"inspection_id": inspection_id}).to_list(100)
    doc["items"] = serialize_doc(items)
    doc["total_items"] = len(items)
    doc["passed_items"] = sum(1 for i in items if i.get("status") == "pass")
    doc["failed_items"] = sum(1 for i in items if i.get("status") == "fail")
    # Media
    media = await db.media.find({"owner_type": "inspection", "owner_id": inspection_id}, {"base64_data": 0}).to_list(50)
    doc["media"] = serialize_doc(media)
    return doc

@router.post("")
async def create_inspection(input: InspectionCreate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "property_id": input.property_id,
        "turnover_id": input.turnover_id,
        "assigned_inspector_id": user["id"],
        "status": "pending",
        "due_at": input.due_at or now,
        "started_at": None,
        "completed_at": None,
        "score": None,
        "result": None,
        "created_at": now,
    }
    result = await db.inspections.insert_one(doc)
    insp_id = str(result.inserted_id)
    # Auto-create inspection items from checklist template
    template = await db.checklist_templates.find_one({"active": True})
    if template:
        items = await db.checklist_template_items.find({"checklist_template_id": str(template["_id"])}).to_list(100)
        insp_items = [{
            "inspection_id": insp_id,
            "checklist_template_item_id": str(item["_id"]),
            "title": item["title"],
            "room_name": item.get("room_name", "General"),
            "status": "pending",
            "note": "",
            "requires_photo": item.get("requires_photo", False),
            "completed_by_user_id": None,
            "completed_at": None,
        } for item in items]
        if insp_items:
            await db.inspection_items.insert_many(insp_items)
    # Return serialized response without MongoDB _id
    return {
        "id": insp_id,
        "property_id": input.property_id,
        "turnover_id": input.turnover_id,
        "assigned_inspector_id": user["id"],
        "status": "pending",
        "due_at": input.due_at or now,
        "created_at": now,
    }

@router.put("/{inspection_id}/items/{item_id}")
async def update_inspection_item(inspection_id: str, item_id: str, input: InspectionItemUpdate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    update = {
        "status": input.status,
        "note": input.note,
        "completed_by_user_id": user["id"],
        "completed_at": now,
    }
    await db.inspection_items.update_one({"_id": ObjectId(item_id)}, {"$set": update})
    # Recalculate inspection score
    items = await db.inspection_items.find({"inspection_id": inspection_id}).to_list(100)
    total = len(items)
    passed = sum(1 for i in items if i.get("status") == "pass")
    failed = sum(1 for i in items if i.get("status") == "fail")
    completed = passed + failed
    score = round((passed / max(total, 1)) * 100)
    insp_update = {"score": score}
    if completed == total:
        insp_update["status"] = "passed" if failed == 0 else "failed"
        insp_update["result"] = "pass" if failed == 0 else "fail"
        insp_update["completed_at"] = now
    else:
        insp_update["status"] = "in_progress"
        if not (await db.inspections.find_one({"_id": ObjectId(inspection_id)})).get("started_at"):
            insp_update["started_at"] = now
    await db.inspections.update_one({"_id": ObjectId(inspection_id)}, {"$set": insp_update})
    return {"success": True, "score": score, "passed": passed, "failed": failed, "total": total}

@router.post("/{inspection_id}/reclean")
async def request_reclean(inspection_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    insp = await db.inspections.find_one({"_id": ObjectId(inspection_id)})
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    # Reset failed items to pending
    await db.inspection_items.update_many({"inspection_id": inspection_id, "status": "fail"}, {"$set": {"status": "pending", "completed_at": None}})
    await db.inspections.update_one({"_id": ObjectId(inspection_id)}, {"$set": {"status": "reclean_requested", "result": None, "score": None}})
    return {"success": True, "message": "Reclean requested"}

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/turnovers", tags=["turnovers"])

def get_db(request: Request):
    return request.app.state.db

class TurnoverCreate(BaseModel):
    property_id: str
    reservation_id: Optional[str] = None
    title: str
    due_at: str
    notes: str = ""

class TurnoverUpdate(BaseModel):
    status: Optional[str] = None
    assigned_provider_id: Optional[str] = None
    notes: Optional[str] = None
    risk_level: Optional[str] = None

@router.get("")
async def list_turnovers(request: Request, status: Optional[str] = None, property_id: Optional[str] = None):
    db = get_db(request)
    user = await get_current_user(request, db)
    query = {}
    if status:
        query["status"] = status
    if property_id:
        query["property_id"] = property_id
    turnovers = await db.turnovers.find(query).sort("due_at", 1).to_list(100)
    result = []
    for t in turnovers:
        doc = serialize_doc(t)
        # Get property name
        if t.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(t["property_id"])})
                doc["property_name"] = prop.get("name", "") if prop else ""
                doc["property_address"] = prop.get("address_1", "") if prop else ""
            except Exception:
                doc["property_name"] = ""
                doc["property_address"] = ""
        # Get linked issues count
        tid = str(t["_id"])
        doc["issues_count"] = await db.issues.count_documents({"turnover_id": tid})
        # Get checklist progress
        checklist = await db.turnover_checklists.find_one({"turnover_id": tid})
        if checklist:
            doc["checklist_progress"] = checklist.get("completion_percent", 0)
        else:
            doc["checklist_progress"] = 0
        # Get assigned cleaner name
        if t.get("assigned_provider_id"):
            try:
                provider = await db.users.find_one({"_id": ObjectId(t["assigned_provider_id"])})
                doc["assigned_name"] = f"{provider.get('first_name', '')} {provider.get('last_name', '')}" if provider else "Unassigned"
            except Exception:
                doc["assigned_name"] = "Unassigned"
        else:
            doc["assigned_name"] = "Unassigned"
        result.append(doc)
    return result

@router.get("/{turnover_id}")
async def get_turnover(turnover_id: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    turnover = await db.turnovers.find_one({"_id": ObjectId(turnover_id)})
    if not turnover:
        raise HTTPException(status_code=404, detail="Turnover not found")
    doc = serialize_doc(turnover)
    # Property info
    if turnover.get("property_id"):
        try:
            prop = await db.properties.find_one({"_id": ObjectId(turnover["property_id"])})
            doc["property"] = serialize_doc(prop) if prop else None
        except Exception:
            doc["property"] = None
    # Reservation info
    if turnover.get("reservation_id"):
        try:
            res = await db.reservations.find_one({"_id": ObjectId(turnover["reservation_id"])})
            doc["reservation"] = serialize_doc(res) if res else None
        except Exception:
            doc["reservation"] = None
    # Linked issues
    doc["issues"] = serialize_doc(await db.issues.find({"turnover_id": str(turnover["_id"])}).to_list(50))
    # Checklist
    checklist = await db.turnover_checklists.find_one({"turnover_id": str(turnover["_id"])})
    if checklist:
        items = await db.turnover_checklist_items.find({"turnover_checklist_id": str(checklist["_id"])}).to_list(100)
        doc["checklist"] = serialize_doc(checklist)
        doc["checklist_items"] = serialize_doc(items)
    else:
        doc["checklist"] = None
        doc["checklist_items"] = []
    return doc

@router.post("")
async def create_turnover(input: TurnoverCreate, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    doc = {
        "property_id": input.property_id,
        "reservation_id": input.reservation_id,
        "title": input.title,
        "status": "new",
        "cleaner_assignment_type": "individual",
        "assigned_provider_id": None,
        "due_at": input.due_at,
        "ready_for_inspection_at": None,
        "completed_at": None,
        "readiness_score": 0,
        "risk_level": "normal",
        "notes": input.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.turnovers.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc

@router.put("/{turnover_id}")
async def update_turnover(turnover_id: str, input: TurnoverUpdate, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if input.status:
        update["status"] = input.status
    if input.assigned_provider_id:
        update["assigned_provider_id"] = input.assigned_provider_id
    if input.notes is not None:
        update["notes"] = input.notes
    if input.risk_level:
        update["risk_level"] = input.risk_level
    if input.status == "completed":
        update["completed_at"] = datetime.now(timezone.utc).isoformat()
    await db.turnovers.update_one({"_id": ObjectId(turnover_id)}, {"$set": update})
    updated = await db.turnovers.find_one({"_id": ObjectId(turnover_id)})
    return serialize_doc(updated)

@router.get("/{turnover_id}/checklist")
async def get_turnover_checklist(turnover_id: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    checklist = await db.turnover_checklists.find_one({"turnover_id": turnover_id})
    if not checklist:
        raise HTTPException(status_code=404, detail="No checklist found for this turnover")
    items = await db.turnover_checklist_items.find({"turnover_checklist_id": str(checklist["_id"])}).sort("sort_order", 1).to_list(200)
    return {
        "checklist": serialize_doc(checklist),
        "items": serialize_doc(items)
    }

@router.put("/checklist-items/{item_id}")
async def update_checklist_item(item_id: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    body = await request.json()
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if "status" in body:
        update["status"] = body["status"]
        if body["status"] == "completed":
            update["completed_at"] = datetime.now(timezone.utc).isoformat()
            update["completed_by_user_id"] = user["id"]
    if "note" in body:
        update["note"] = body["note"]
    await db.turnover_checklist_items.update_one({"_id": ObjectId(item_id)}, {"$set": update})
    # Recalculate checklist progress
    item = await db.turnover_checklist_items.find_one({"_id": ObjectId(item_id)})
    if item:
        checklist_id = item["turnover_checklist_id"]
        all_items = await db.turnover_checklist_items.find({"turnover_checklist_id": checklist_id}).to_list(200)
        completed = sum(1 for i in all_items if i.get("status") == "completed")
        percent = round((completed / max(len(all_items), 1)) * 100)
        await db.turnover_checklists.update_one({"_id": ObjectId(checklist_id)}, {"$set": {"completion_percent": percent}})
    return {"success": True}

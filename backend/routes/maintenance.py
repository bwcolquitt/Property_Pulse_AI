from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/issues", tags=["maintenance"])

def get_db(request: Request):
    return request.app.state.db

OUTSTANDING_STATUSES = ["new", "not_started", "assigned", "in_progress", "awaiting_approval", "awaiting_parts", "scheduled", "blocked", "reopened"]

class IssueCreate(BaseModel):
    property_id: str
    turnover_id: Optional[str] = None
    title: str
    description: str = ""
    issue_type: str = "maintenance"
    trade_type: str = "general"
    priority: str = "medium"
    location_in_property: str = ""
    blocks_check_in: bool = False
    guest_impact_level: str = "low"
    can_be_done_during_turnover: bool = False

class IssueUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_provider_id: Optional[str] = None
    description: Optional[str] = None
    estimate_amount: Optional[float] = None
    estimate_status: Optional[str] = None
    scheduled_start_at: Optional[str] = None
    due_at: Optional[str] = None

class CommentCreate(BaseModel):
    comment_text: str

@router.get("")
async def list_issues(
    request: Request,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    property_id: Optional[str] = None,
    trade_type: Optional[str] = None,
    assigned_provider_id: Optional[str] = None,
    unassigned: Optional[bool] = None,
    blocks_check_in: Optional[bool] = None,
    outstanding: Optional[bool] = True,
):
    db = get_db(request)
    user = await get_current_user(request, db)
    query = {}
    if status:
        query["status"] = status
    elif outstanding:
        query["status"] = {"$in": OUTSTANDING_STATUSES}
    if priority:
        query["priority"] = priority
    if property_id:
        query["property_id"] = property_id
    if trade_type:
        query["trade_type"] = trade_type
    if assigned_provider_id:
        query["assigned_provider_id"] = assigned_provider_id
    if unassigned:
        query["assigned_provider_id"] = None
    if blocks_check_in:
        query["blocks_check_in"] = True
    # Role-based filtering: maintenance techs only see their assigned issues
    if user.get("role") == "maintenance_technician":
        query["assigned_provider_id"] = user["id"]

    issues = await db.issues.find(query).sort("created_at", -1).to_list(200)
    result = []
    for issue in issues:
        doc = serialize_doc(issue)
        # Get property name
        if issue.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(issue["property_id"])})
                doc["property_name"] = prop.get("name", "") if prop else ""
            except Exception:
                doc["property_name"] = ""
        # Get assigned vendor name
        if issue.get("assigned_provider_id"):
            try:
                vendor = await db.users.find_one({"_id": ObjectId(issue["assigned_provider_id"])})
                doc["assigned_name"] = f"{vendor.get('first_name', '')} {vendor.get('last_name', '')}" if vendor else "Unassigned"
            except Exception:
                doc["assigned_name"] = "Unassigned"
        else:
            doc["assigned_name"] = "Unassigned"
        # Photo count
        doc["photo_count"] = await db.media.count_documents({"owner_type": "issue", "owner_id": str(issue["_id"])})
        result.append(doc)
    return result

@router.get("/{issue_id}")
async def get_issue(issue_id: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    issue = await db.issues.find_one({"_id": ObjectId(issue_id)})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    doc = serialize_doc(issue)
    # Property
    if issue.get("property_id"):
        try:
            prop = await db.properties.find_one({"_id": ObjectId(issue["property_id"])})
            doc["property"] = serialize_doc(prop) if prop else None
        except Exception:
            doc["property"] = None
    # Comments
    comments = await db.issue_comments.find({"issue_id": issue_id}).sort("created_at", 1).to_list(100)
    enriched_comments = []
    for c in comments:
        cd = serialize_doc(c)
        if c.get("user_id"):
            try:
                u = await db.users.find_one({"_id": ObjectId(c["user_id"])})
                cd["user_name"] = f"{u.get('first_name', '')} {u.get('last_name', '')}" if u else "Unknown"
            except Exception:
                cd["user_name"] = "Unknown"
        enriched_comments.append(cd)
    doc["comments"] = enriched_comments
    # Status history
    history = await db.issue_status_history.find({"issue_id": issue_id}).sort("created_at", 1).to_list(100)
    doc["status_history"] = serialize_doc(history)
    # Media
    media = await db.media.find({"owner_type": "issue", "owner_id": issue_id}).to_list(50)
    doc["media"] = serialize_doc(media)
    return doc

@router.post("")
async def create_issue(input: IssueCreate, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **input.dict(),
        "source_type": "manual",
        "source_user_id": user["id"],
        "status": "new",
        "assigned_provider_id": None,
        "estimate_amount": None,
        "estimate_status": None,
        "scheduled_start_at": None,
        "scheduled_end_at": None,
        "completed_at": None,
        "reopened_count": 0,
        "due_at": None,
        "next_check_in_at": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.issues.insert_one(doc)
    issue_id = str(result.inserted_id)
    # Record status history
    await db.issue_status_history.insert_one({
        "issue_id": issue_id,
        "old_status": None,
        "new_status": "new",
        "changed_by_user_id": user["id"],
        "note": "Issue created",
        "created_at": now,
    })
    doc["id"] = issue_id
    return doc

@router.put("/{issue_id}")
async def update_issue(issue_id: str, input: IssueUpdate, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    existing = await db.issues.find_one({"_id": ObjectId(issue_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Issue not found")
    now = datetime.now(timezone.utc).isoformat()
    update = {"updated_at": now}
    for field, value in input.dict(exclude_unset=True).items():
        if value is not None:
            update[field] = value
    # Record status change
    if input.status and input.status != existing.get("status"):
        await db.issue_status_history.insert_one({
            "issue_id": issue_id,
            "old_status": existing.get("status"),
            "new_status": input.status,
            "changed_by_user_id": user["id"],
            "note": f"Status changed to {input.status}",
            "created_at": now,
        })
        if input.status == "completed":
            update["completed_at"] = now
        if input.status == "reopened":
            update["reopened_count"] = existing.get("reopened_count", 0) + 1
    await db.issues.update_one({"_id": ObjectId(issue_id)}, {"$set": update})
    updated = await db.issues.find_one({"_id": ObjectId(issue_id)})
    return serialize_doc(updated)

@router.post("/{issue_id}/comments")
async def add_comment(issue_id: str, input: CommentCreate, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    doc = {
        "issue_id": issue_id,
        "user_id": user["id"],
        "comment_text": input.comment_text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.issue_comments.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}"
    return doc

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone, timedelta
from bson import ObjectId

router = APIRouter(prefix="/api/admin", tags=["admin"])

def get_db(request: Request):
    return request.app.state.db

OUTSTANDING = ["new", "not_started", "assigned", "in_progress", "awaiting_approval", "awaiting_parts", "scheduled", "blocked", "reopened"]

class EstimateAction(BaseModel):
    action: str  # "approve", "reject", "revise"
    revised_amount: Optional[float] = None
    notes: str = ""

class ReorderItems(BaseModel):
    turnover_id: str
    item_order: List[str]  # list of item IDs in new order

class TurnoverServiceAssign(BaseModel):
    turnover_id: str
    service_type: str  # cleaning, maintenance, pool
    provider_id: Optional[str] = None
    scheduled_at: Optional[str] = None

@router.get("/review-queue")
async def get_review_queue(request: Request):
    """Get all issues with AI estimates awaiting admin review."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") not in ["property_manager", "super_admin", "operations_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    issues = await db.issues.find({"estimate_status": "ai_pending_review"}).sort("created_at", -1).to_list(100)
    result = []
    for issue in issues:
        doc = serialize_doc(issue)
        if issue.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(issue["property_id"])})
                doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
            except Exception:
                doc["property_name"] = ""
        doc["photo_count"] = await db.media.count_documents({"owner_type": "issue", "owner_id": str(issue["_id"])})
        result.append(doc)
    return result

@router.get("/dashboard-stats")
async def admin_dashboard_stats(request: Request):
    """Extended admin dashboard stats."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") not in ["property_manager", "super_admin", "operations_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    pending_estimates = await db.issues.count_documents({"estimate_status": "ai_pending_review"})
    total_outstanding = await db.issues.count_documents({"status": {"$in": OUTSTANDING}})
    urgent_issues = await db.issues.count_documents({"status": {"$in": OUTSTANDING}, "priority": "urgent"})
    unread_notifs = await db.notifications.count_documents({"user_id": user["id"], "read_at": None})
    
    # Upcoming turnovers (next 7 days)
    now = datetime.now(timezone.utc)
    week_ahead = (now + timedelta(days=7)).isoformat()
    upcoming_turnovers = await db.turnovers.find({"due_at": {"$lte": week_ahead}, "status": {"$nin": ["completed"]}}).sort("due_at", 1).to_list(20)
    enriched_turnovers = []
    for t in upcoming_turnovers:
        doc = serialize_doc(t)
        if t.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(t["property_id"])})
                doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
            except Exception:
                doc["property_name"] = ""
        # Get service assignments
        assigns = await db.turnover_service_assignments.find({"turnover_id": str(t["_id"])}).to_list(10)
        doc["service_assignments"] = serialize_doc(assigns)
        enriched_turnovers.append(doc)
    
    # Total pending estimate value
    pending_issues = await db.issues.find({"estimate_status": "ai_pending_review"}).to_list(100)
    total_pending_value = sum(i.get("estimate_amount", 0) or 0 for i in pending_issues)
    
    return {
        "pending_estimates": pending_estimates,
        "total_pending_value": round(total_pending_value, 2),
        "total_outstanding_issues": total_outstanding,
        "urgent_issues": urgent_issues,
        "unread_notifications": unread_notifs,
        "upcoming_turnovers": enriched_turnovers,
    }

@router.put("/estimate/{issue_id}")
async def action_estimate(issue_id: str, input: EstimateAction, request: Request):
    """Approve, reject, or revise an AI estimate."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") not in ["property_manager", "super_admin", "operations_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    issue = await db.issues.find_one({"_id": ObjectId(issue_id)})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    if input.action == "approve":
        update = {"estimate_status": "approved", "updated_at": now}
        if issue.get("ai_estimate"):
            ai_est = issue["ai_estimate"]
            ai_est["approved_by"] = user["id"]
            ai_est["approved_at"] = now
            update["ai_estimate"] = ai_est
        await db.issues.update_one({"_id": ObjectId(issue_id)}, {"$set": update})
        await db.issue_status_history.insert_one({"issue_id": issue_id, "old_status": issue.get("estimate_status"), "new_status": "approved", "changed_by_user_id": user["id"], "note": f"Estimate approved: ${issue.get('estimate_amount', 0)}", "created_at": now})
    elif input.action == "reject":
        await db.issues.update_one({"_id": ObjectId(issue_id)}, {"$set": {"estimate_status": "rejected", "updated_at": now}})
        await db.issue_status_history.insert_one({"issue_id": issue_id, "old_status": "ai_pending_review", "new_status": "rejected", "changed_by_user_id": user["id"], "note": f"Estimate rejected. {input.notes}", "created_at": now})
    elif input.action == "revise":
        update = {"estimate_status": "approved", "estimate_amount": input.revised_amount, "updated_at": now}
        if issue.get("ai_estimate"):
            ai_est = issue["ai_estimate"]
            ai_est["revised_by"] = user["id"]
            ai_est["revised_amount"] = input.revised_amount
            ai_est["original_total"] = ai_est.get("total_estimate")
            ai_est["total_estimate"] = input.revised_amount
            update["ai_estimate"] = ai_est
        await db.issues.update_one({"_id": ObjectId(issue_id)}, {"$set": update})
        await db.issue_status_history.insert_one({"issue_id": issue_id, "old_status": "ai_pending_review", "new_status": "approved_revised", "changed_by_user_id": user["id"], "note": f"Estimate revised to ${input.revised_amount}. {input.notes}", "created_at": now})
    
    return {"success": True, "action": input.action}

@router.post("/reorder-checklist")
async def reorder_checklist(input: ReorderItems, request: Request):
    """Reorder checklist items for a turnover."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    
    for i, item_id in enumerate(input.item_order):
        await db.turnover_checklist_items.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": {"sort_order": i + 1}}
        )
    return {"success": True, "reordered": len(input.item_order)}

@router.get("/calendar")
async def calendar_turnovers(request: Request, month: Optional[str] = None):
    """Get turnovers for calendar view with service assignments."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    
    turnovers = await db.turnovers.find().sort("due_at", 1).to_list(200)
    result = []
    for t in turnovers:
        doc = serialize_doc(t)
        if t.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(t["property_id"])})
                doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
                doc["property_address"] = f"{prop.get('address_1', '')}, {prop.get('city', '')}" if prop else ""
            except Exception:
                doc["property_name"] = ""
                doc["property_address"] = ""
        # Service assignments
        assigns = await db.turnover_service_assignments.find({"turnover_id": str(t["_id"])}).to_list(10)
        doc["service_assignments"] = serialize_doc(assigns)
        # Assigned provider
        if t.get("assigned_provider_id"):
            try:
                prov = await db.users.find_one({"_id": ObjectId(t["assigned_provider_id"])})
                doc["assigned_name"] = f"{prov.get('first_name', '')} {prov.get('last_name', '')}" if prov else "Unassigned"
            except Exception:
                doc["assigned_name"] = "Unassigned"
        else:
            doc["assigned_name"] = "Unassigned"
        result.append(doc)
    return result

@router.post("/assign-service")
async def assign_service_to_turnover(input: TurnoverServiceAssign, request: Request):
    """Assign a service company to a turnover."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") not in ["property_manager", "super_admin", "operations_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc).isoformat()
    # Upsert service assignment
    await db.turnover_service_assignments.update_one(
        {"turnover_id": input.turnover_id, "service_type": input.service_type},
        {"$set": {
            "turnover_id": input.turnover_id,
            "service_type": input.service_type,
            "provider_id": input.provider_id,
            "scheduled_at": input.scheduled_at,
            "status": "assigned",
            "assigned_by": user["id"],
            "updated_at": now,
        }},
        upsert=True
    )
    return {"success": True}

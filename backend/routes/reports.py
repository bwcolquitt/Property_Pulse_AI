from fastapi import APIRouter, Request
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone

router = APIRouter(prefix="/api/reports", tags=["reports"])

def get_db(request: Request):
    return request.app.state.db

OUTSTANDING_STATUSES = ["new", "not_started", "assigned", "in_progress", "awaiting_approval", "awaiting_parts", "scheduled", "blocked", "reopened"]

@router.get("")
async def get_report_types(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    return [
        {"id": "outstanding_maintenance", "name": "Outstanding Maintenance", "description": "All open maintenance issues"},
        {"id": "guest_readiness", "name": "Guest Readiness", "description": "Property readiness for upcoming guests"},
        {"id": "turnover_completion", "name": "Turnover Completion", "description": "Turnover completion rates and times"},
        {"id": "cleaner_scorecard", "name": "Cleaner Scorecard", "description": "Cleaner performance metrics"},
        {"id": "issue_trends", "name": "Issue Trends by Property", "description": "Issue trends across properties"},
        {"id": "vendor_performance", "name": "Vendor Performance", "description": "Vendor scorecards and metrics"},
    ]

@router.get("/outstanding-maintenance")
async def outstanding_maintenance_report(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    issues = await db.issues.find({"status": {"$in": OUTSTANDING_STATUSES}}).to_list(500)
    return serialize_doc(issues)

@router.get("/guest-readiness")
async def guest_readiness_report(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    properties = await db.properties.find({"status": "active"}).to_list(100)
    result = []
    for p in properties:
        pid = str(p["_id"])
        open_issues = await db.issues.count_documents({"property_id": pid, "status": {"$in": OUTSTANDING_STATUSES}})
        blocking_issues = await db.issues.count_documents({"property_id": pid, "blocks_check_in": True, "status": {"$in": OUTSTANDING_STATUSES}})
        active_turnovers = await db.turnovers.count_documents({"property_id": pid, "status": {"$nin": ["completed"]}})
        doc = serialize_doc(p)
        doc["open_issues"] = open_issues
        doc["blocking_issues"] = blocking_issues
        doc["active_turnovers"] = active_turnovers
        doc["ready"] = open_issues == 0 and blocking_issues == 0
        result.append(doc)
    return result

@router.get("/turnover-completion")
async def turnover_completion_report(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    turnovers = await db.turnovers.find().sort("due_at", -1).to_list(200)
    return serialize_doc(turnovers)

@router.get("/team")
async def team_report(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    users = await db.users.find({}, {"password_hash": 0}).to_list(100)
    result = []
    for u in users:
        doc = serialize_doc(u)
        doc["assigned_turnovers"] = await db.turnovers.count_documents({"assigned_provider_id": str(u["_id"])})
        doc["assigned_issues"] = await db.issues.count_documents({"assigned_provider_id": str(u["_id"])})
        result.append(doc)
    return result

from fastapi import APIRouter, Request
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

def get_db(request: Request):
    return request.app.state.db

@router.get("/stats")
async def get_dashboard_stats(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today.replace(hour=23, minute=59, second=59)

    # Today's turnovers
    todays_turnovers = await db.turnovers.count_documents({
        "due_at": {"$gte": today.isoformat(), "$lte": tomorrow.isoformat()}
    })

    # Outstanding maintenance
    outstanding_statuses = ["new", "not_started", "assigned", "in_progress", "awaiting_approval", "awaiting_parts", "scheduled", "blocked", "reopened"]
    total_outstanding = await db.issues.count_documents({"status": {"$in": outstanding_statuses}})
    urgent_count = await db.issues.count_documents({"status": {"$in": outstanding_statuses}, "priority": "urgent"})
    unassigned_count = await db.issues.count_documents({"status": {"$in": outstanding_statuses}, "assigned_provider_id": None})
    blocking_count = await db.issues.count_documents({"status": {"$in": outstanding_statuses}, "blocks_check_in": True})
    due_today = await db.issues.count_documents({
        "status": {"$in": outstanding_statuses},
        "due_at": {"$gte": today.isoformat(), "$lte": tomorrow.isoformat()}
    })

    # Properties at risk
    at_risk = await db.turnovers.count_documents({"risk_level": "at_risk"})

    # Pending inspections
    pending_inspections = await db.inspections.count_documents({"status": "pending"})

    # Active cleaners / vendors
    active_cleaners = await db.turnovers.count_documents({"status": "in_progress"})

    # Total properties
    total_properties = await db.properties.count_documents({})

    # Recent issues
    recent_issues = await db.issues.find({"status": {"$in": outstanding_statuses}}).sort("created_at", -1).limit(5).to_list(5)

    # Today's turnovers list
    turnovers_list = await db.turnovers.find({
        "due_at": {"$gte": today.isoformat(), "$lte": tomorrow.isoformat()}
    }).to_list(20)

    # Readiness score
    total_turnovers = await db.turnovers.count_documents({})
    completed_turnovers = await db.turnovers.count_documents({"status": "completed"})
    readiness_score = round((completed_turnovers / max(total_turnovers, 1)) * 100)

    return {
        "todays_turnovers": todays_turnovers,
        "total_outstanding_maintenance": total_outstanding,
        "urgent_maintenance": urgent_count,
        "unassigned_maintenance": unassigned_count,
        "blocking_guest": blocking_count,
        "due_today_maintenance": due_today,
        "properties_at_risk": at_risk,
        "pending_inspections": pending_inspections,
        "active_cleaners": active_cleaners,
        "total_properties": total_properties,
        "readiness_score": readiness_score,
        "recent_issues": serialize_doc(recent_issues),
        "todays_turnovers_list": serialize_doc(turnovers_list),
    }

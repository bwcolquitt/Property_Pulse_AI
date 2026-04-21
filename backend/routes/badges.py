"""Dashboard Badges - unread counts for dashboard/nav indicators."""
from fastapi import APIRouter, Request, HTTPException
from helpers import get_current_user

router = APIRouter(prefix="/api/badges", tags=["badges"])

def get_db(request: Request):
    return request.app.state.db

@router.get("")
async def get_badges(request: Request):
    """Return all badge counts used for UI indicators in one round trip."""
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        return {}

    host_inbox_new = await db.guest_messages.count_documents({"status": "new"})
    outstanding_issues = await db.issues.count_documents({"status": {"$in": ["new", "in_progress"]}})
    urgent_issues = await db.issues.count_documents({"priority": "urgent", "status": {"$ne": "completed"}})
    pending_turnovers = await db.turnovers.count_documents({"status": {"$in": ["new", "assigned", "in_progress"]}})
    unread_notifications = await db.notifications.count_documents({"read": False})
    low_inventory = await db.guest_inventory.count_documents({"$expr": {"$lte": ["$quantity", "$reorder_point"]}}) if hasattr(db, "guest_inventory") else 0

    # Setup wizard completeness
    company = await db.company_settings.find_one({"tenant_id": user.get("tenant_id", "default")}) or {}
    email = await db.email_config.find_one({"tenant_id": user.get("tenant_id", "default")}) or {}
    ical_count = await db.ical_feeds.count_documents({})
    props = await db.properties.count_documents({"active": {"$ne": False}})
    team = await db.users.count_documents({"role": {"$in": ["cleaner", "maintenance"]}})
    required_flags = [
        bool(company.get("name") and company.get("email")),
        bool(email.get("enabled") and email.get("provider", "disabled") != "disabled"),
        props > 0,
        ical_count > 0,
        team > 0,
    ]
    setup_incomplete = len([f for f in required_flags if not f])

    return {
        "host_inbox_new": host_inbox_new,
        "outstanding_issues": outstanding_issues,
        "urgent_issues": urgent_issues,
        "pending_turnovers": pending_turnovers,
        "unread_notifications": unread_notifications,
        "low_inventory": low_inventory,
        "setup_incomplete": setup_incomplete,
    }

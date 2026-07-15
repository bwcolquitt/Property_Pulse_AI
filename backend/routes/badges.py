"""Dashboard Badges - unread counts for dashboard/nav indicators."""
from fastapi import APIRouter, Request, HTTPException
from helpers import get_current_user
from tenant_db import get_tenant_db

router = APIRouter(prefix="/api/badges", tags=["badges"])

def get_db(request: Request):
    return request.app.state.db

@router.get("")
async def get_badges(request: Request):
    """Return all badge counts used for UI indicators in one round trip."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        return {}

    host_inbox_new = await db.guest_messages.count_documents({"status": "new"})
    outstanding_issues = await db.issues.count_documents({"status": {"$in": ["new", "in_progress"]}})
    urgent_issues = await db.issues.count_documents({"priority": "urgent", "status": {"$ne": "completed"}})
    pending_turnovers = await db.turnovers.count_documents({"status": {"$in": ["new", "assigned", "in_progress"]}})
    unread_notifications = await db.notifications.count_documents({"read": False})
    low_inventory = await db.guest_inventory.count_documents({"$expr": {"$lte": ["$quantity", "$reorder_point"]}})

    # Team messages unread (across conversations user is a participant in)
    team_msgs_unread = 0
    try:
        parts = await db.conversation_participants.find({"user_id": user["id"]}).to_list(500)
        for p in parts:
            last_read = p.get("last_read_at", "1970-01-01")
            team_msgs_unread += await db.messages.count_documents({
                "conversation_id": p["conversation_id"],
                "created_at": {"$gt": last_read},
                "sender_user_id": {"$ne": user["id"]},
            })
    except Exception:
        pass

    # Setup wizard completeness (all tenant-scoped via tdb)
    company = await db.company_settings.find_one({}) or {}
    email = await db.email_config.find_one({}) or {}
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
        "team_messages_unread": team_msgs_unread,
    }

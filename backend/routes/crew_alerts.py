from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/crew-alerts", tags=["crew-alerts"])

def get_db(request: Request):
    return request.app.state.db

class GuestPresentAlert(BaseModel):
    property_id: str
    turnover_id: Optional[str] = None
    notes: str = ""

@router.post("/guest-present")
async def report_guest_present(input: GuestPresentAlert, request: Request):
    """Service crew reports guests still in property. Creates alert + issue."""
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc).isoformat()
    prop = await db.properties.find_one({"_id": ObjectId(input.property_id)})
    prop_name = prop.get("nickname", prop.get("name", "")) if prop else "Unknown"
    alert_doc = {
        "type": "guest_still_present",
        "property_id": input.property_id,
        "property_name": prop_name,
        "turnover_id": input.turnover_id,
        "notes": input.notes,
        "reported_by": user["id"],
        "reported_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
        "status": "active",
        "created_at": now,
    }
    await db.crew_alerts.insert_one(alert_doc)
    issue_doc = {
        "property_id": input.property_id,
        "turnover_id": input.turnover_id,
        "title": f"Guest still present at {prop_name}",
        "description": f"Service crew arrived for turnover but guests have not checked out. {input.notes}",
        "priority": "urgent",
        "status": "new",
        "trade_type": "access",
        "source_user_id": user["id"],
        "blocks_check_in": True,
        "created_at": now,
    }
    await db.issues.insert_one(issue_doc)
    await db.notifications.insert_one({"type": "guest_present_alert", "title": f"URGENT: Guest still at {prop_name}", "body": f"{user.get('first_name', '')} reports guests have not left. Turnover cannot begin.", "read": False, "created_at": now})
    return {"success": True, "message": f"Alert sent! Admin notified about guest at {prop_name}"}

@router.get("")
async def list_alerts(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    alerts = await db.crew_alerts.find({"status": "active"}).sort("created_at", -1).to_list(50)
    return [serialize_doc(a) for a in alerts]

@router.put("/{alert_id}/resolve")
async def resolve_alert(alert_id: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    await db.crew_alerts.update_one({"_id": ObjectId(alert_id)}, {"$set": {"status": "resolved", "resolved_at": datetime.now(timezone.utc).isoformat()}})
    return {"success": True}

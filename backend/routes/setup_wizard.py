"""Setup Wizard Status - helps admin know what's configured and what's missing."""
from fastapi import APIRouter, Request, HTTPException
from helpers import get_current_user
from tenant_db import get_tenant_db

router = APIRouter(prefix="/api/setup", tags=["setup"])

def get_db(request: Request):
    return request.app.state.db

@router.get("/status")
async def setup_status(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")

    company = await db.company_settings.find_one({}) or {}
    sms = await db.sms_config.find_one({}) or {}
    email = await db.email_config.find_one({}) or {}
    ical_feeds = await db.ical_feeds.count_documents({}) if hasattr(db, "ical_feeds") else 0
    pms_conns = await db.pms_connections.count_documents({}) if hasattr(db, "pms_connections") else 0
    properties = await db.properties.count_documents({"active": {"$ne": False}})
    cleaners = await db.users.count_documents({"role": "cleaner"})
    maintenance = await db.users.count_documents({"role": "maintenance"})
    reservations = await db.reservations.count_documents({})

    steps = [
        {
            "id": "brand",
            "title": "Brand your company",
            "description": "Set your name, phone, email, and logo so guests see your branding",
            "complete": bool(company.get("name") and company.get("phone") and company.get("email")),
            "action_label": "Configure",
            "route": "/company-config",
            "priority": 1,
        },
        {
            "id": "email",
            "title": "Enable email delivery",
            "description": "Send guest welcome links, receipts, and host alerts via email",
            "complete": bool(email.get("enabled") and email.get("provider", "disabled") != "disabled"),
            "action_label": "Set up",
            "route": "/email-config",
            "priority": 2,
        },
        {
            "id": "properties",
            "title": "Add your first property",
            "description": "Properties are the foundation — cleaning, maintenance, and reservations link to them",
            "complete": properties > 0,
            "action_label": "Add Property",
            "route": "/property/create",
            "priority": 3,
            "count": properties,
        },
        {
            "id": "ical",
            "title": "Sync reservations (iCal)",
            "description": "Paste Airbnb/Vrbo/Booking iCal URLs to auto-import guest reservations",
            "complete": ical_feeds > 0,
            "action_label": "Add iCal Feed",
            "route": "/ical-feeds",
            "priority": 4,
            "count": ical_feeds,
        },
        {
            "id": "team",
            "title": "Invite your cleaners & crew",
            "description": "Assign turnovers, track photo completion, and score performance",
            "complete": cleaners > 0 or maintenance > 0,
            "action_label": "Invite Team",
            "route": "/team",
            "priority": 5,
            "count": cleaners + maintenance,
        },
        {
            "id": "sms",
            "title": "SMS delivery (optional)",
            "description": "Text check-in links and reminders. Recommended: QUO. Optional — you can use Copy-Link instead",
            "complete": bool(sms.get("enabled") and sms.get("provider", "disabled") != "disabled"),
            "action_label": "Set up",
            "route": "/sms-config",
            "priority": 6,
            "optional": True,
        },
        {
            "id": "reservations",
            "title": "Verify guest data flows",
            "description": "Send a test magic link to yourself to preview the guest experience",
            "complete": reservations > 0,
            "action_label": "Send Test Link",
            "route": "/send-guest-link",
            "priority": 7,
            "optional": True,
        },
    ]

    done = len([s for s in steps if s["complete"]])
    required = [s for s in steps if not s.get("optional")]
    required_done = len([s for s in required if s["complete"]])
    progress = round((required_done / len(required)) * 100) if required else 100

    return {
        "steps": steps,
        "total": len(steps),
        "completed": done,
        "progress_pct": progress,
        "required_done": required_done,
        "required_total": len(required),
        "setup_complete": required_done >= len(required),
    }

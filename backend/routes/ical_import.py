"""iCal Import - universal reservation sync from any PMS that publishes iCal.

Almost every PMS and OTA (Airbnb, Vrbo, Booking.com, Hostaway, Lodgify, OwnerRez, etc.)
publishes a per-property iCal URL. Hosts can paste these into Property Pulse without needing
any API keys. The cron endpoint can be hit periodically to resync.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId
import httpx
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ical", tags=["ical"])

def get_db(request: Request):
    return request.app.state.db

class IcalFeedInput(BaseModel):
    property_id: str
    label: str = ""  # e.g., "Airbnb", "Vrbo"
    url: str
    enabled: bool = True

@router.get("/feeds")
async def list_feeds(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    feeds = await db.ical_feeds.find({}).to_list(500)
    out = []
    for f in feeds:
        d = serialize_doc(f)
        if f.get("property_id"):
            try:
                p = await db.properties.find_one({"_id": ObjectId(f["property_id"])})
                if p:
                    d["property_name"] = p.get("nickname") or p.get("name", "")
            except Exception:
                pass
        out.append(d)
    return out

@router.post("/feeds")
async def add_feed(input: IcalFeedInput, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **input.dict(),
        "created_by": user["id"],
        "created_at": now,
        "last_sync_at": "",
        "last_sync_count": 0,
        "last_error": "",
    }
    res = await db.ical_feeds.insert_one(doc)
    return {"success": True, "id": str(res.inserted_id)}

@router.delete("/feeds/{feed_id}")
async def delete_feed(feed_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    await db.ical_feeds.delete_one({"_id": ObjectId(feed_id)})
    return {"success": True}

@router.post("/feeds/{feed_id}/sync")
async def sync_feed(feed_id: str, request: Request):
    """Fetch iCal URL, parse VEVENT entries, upsert into reservations collection."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    feed = await db.ical_feeds.find_one({"_id": ObjectId(feed_id)})
    if not feed:
        raise HTTPException(404, "Feed not found")

    now = datetime.now(timezone.utc)
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            r = await client.get(feed["url"])
            r.raise_for_status()
            raw = r.text
    except Exception as e:
        await db.ical_feeds.update_one({"_id": ObjectId(feed_id)}, {"$set": {"last_error": str(e)[:200], "last_sync_at": now.isoformat()}})
        raise HTTPException(400, f"Failed to fetch iCal: {e}")

    # Parse iCal
    try:
        from icalendar import Calendar
        cal = Calendar.from_ical(raw)
    except Exception as e:
        await db.ical_feeds.update_one({"_id": ObjectId(feed_id)}, {"$set": {"last_error": f"Parse error: {e}"[:200], "last_sync_at": now.isoformat()}})
        raise HTTPException(400, f"Failed to parse iCal: {e}")

    # Get property
    prop = None
    try:
        prop = await db.properties.find_one({"_id": ObjectId(feed["property_id"])})
    except Exception:
        pass
    property_name = (prop or {}).get("nickname") or (prop or {}).get("name", "")

    imported = 0
    skipped = 0
    for component in cal.walk():
        if component.name != "VEVENT":
            continue
        uid = str(component.get("uid", ""))
        summary = str(component.get("summary", "")).strip()
        description = str(component.get("description", "")).strip()
        dtstart = component.get("dtstart")
        dtend = component.get("dtend")
        if not dtstart or not dtend:
            skipped += 1
            continue

        start = dtstart.dt
        end = dtend.dt
        # Normalize date to datetime
        from datetime import date, datetime as _dt
        if isinstance(start, date) and not isinstance(start, _dt):
            start = _dt(start.year, start.month, start.day, tzinfo=timezone.utc)
        if isinstance(end, date) and not isinstance(end, _dt):
            end = _dt(end.year, end.month, end.day, tzinfo=timezone.utc)

        # Detect platform from summary
        src = feed.get("label", "ical")
        low = summary.lower()
        if "airbnb" in low or "airbnb" in description.lower():
            src = "airbnb"
        elif "vrbo" in low or "homeaway" in low:
            src = "vrbo"
        elif "booking.com" in description.lower():
            src = "booking"

        # Skip "blocked" or "not available" (not real reservations)
        if any(k in low for k in ["blocked", "not available", "unavailable", "closed", "reserved (no guest)"]):
            skipped += 1
            continue

        # Extract guest name (best effort - Airbnb often uses "Reserved" / Vrbo uses guest names)
        guest_name = summary if summary and "reserved" not in low else "Guest"
        if guest_name.lower() in ["reserved", "busy", "csv_event_summary"]:
            guest_name = "Guest"

        doc = {
            "property_id": feed["property_id"],
            "property_name": property_name,
            "guest_name": guest_name[:120],
            "guest_email": "",
            "guest_phone": "",
            "check_in_at": start.isoformat(),
            "check_out_at": end.isoformat(),
            "reservation_status": "confirmed",
            "source_platform": src,
            "ical_uid": uid,
            "ical_feed_id": feed_id,
            "synced_at": now.isoformat(),
        }
        # Upsert by uid
        result = await db.reservations.update_one(
            {"ical_uid": uid, "property_id": feed["property_id"]},
            {"$set": doc, "$setOnInsert": {"created_at": now.isoformat()}},
            upsert=True,
        )
        if result.upserted_id:
            imported += 1
        else:
            skipped += 1

    await db.ical_feeds.update_one(
        {"_id": ObjectId(feed_id)},
        {"$set": {"last_sync_at": now.isoformat(), "last_sync_count": imported, "last_error": ""}},
    )
    return {"success": True, "imported": imported, "skipped": skipped, "message": f"Imported {imported} new reservations, {skipped} skipped/existing."}

@router.post("/sync-all")
async def sync_all_feeds(request: Request):
    """Sync all enabled feeds (for scheduled/cron use)."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    feeds = await db.ical_feeds.find({"enabled": True}).to_list(500)
    total_imported = 0
    total_skipped = 0
    errors = []
    for f in feeds:
        try:
            r = await sync_feed(str(f["_id"]), request)
            total_imported += r.get("imported", 0)
            total_skipped += r.get("skipped", 0)
        except Exception as e:
            errors.append({"feed_id": str(f["_id"]), "error": str(e)[:200]})
    return {"success": True, "imported": total_imported, "skipped": total_skipped, "errors": errors, "feeds_synced": len(feeds)}

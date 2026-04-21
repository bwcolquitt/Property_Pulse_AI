"""Background scheduled tasks.

Starts an asyncio task at app startup that periodically syncs iCal feeds.
Interval is controlled by ICAL_SYNC_INTERVAL_MIN env var (default 30 min).
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
from bson import ObjectId

logger = logging.getLogger(__name__)

SYNC_INTERVAL_MIN = int(os.getenv("ICAL_SYNC_INTERVAL_MIN", "30"))
_task: asyncio.Task = None

async def _sync_all_ical(db):
    """Iterate all enabled feeds and sync each."""
    import httpx
    from icalendar import Calendar
    from datetime import date, datetime as _dt
    now = datetime.now(timezone.utc)
    feeds = await db.ical_feeds.find({"enabled": True}).to_list(500)
    for feed in feeds:
        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                r = await client.get(feed["url"])
                r.raise_for_status()
                raw = r.text
            cal = Calendar.from_ical(raw)
            prop = None
            try:
                prop = await db.properties.find_one({"_id": ObjectId(feed["property_id"])})
            except Exception:
                pass
            property_name = (prop or {}).get("nickname") or (prop or {}).get("name", "")
            imported = 0
            for component in cal.walk():
                if component.name != "VEVENT":
                    continue
                uid = str(component.get("uid", ""))
                summary = str(component.get("summary", "")).strip()
                dtstart = component.get("dtstart")
                dtend = component.get("dtend")
                if not dtstart or not dtend or not uid:
                    continue
                start = dtstart.dt; end = dtend.dt
                if isinstance(start, date) and not isinstance(start, _dt):
                    start = _dt(start.year, start.month, start.day, tzinfo=timezone.utc)
                if isinstance(end, date) and not isinstance(end, _dt):
                    end = _dt(end.year, end.month, end.day, tzinfo=timezone.utc)
                low = summary.lower()
                if any(k in low for k in ["blocked", "not available", "unavailable", "closed"]):
                    continue
                doc = {
                    "property_id": feed["property_id"], "property_name": property_name,
                    "guest_name": (summary if "reserved" not in low else "Guest")[:120],
                    "check_in_at": start.isoformat(), "check_out_at": end.isoformat(),
                    "reservation_status": "confirmed", "source_platform": feed.get("label", "ical"),
                    "ical_uid": uid, "ical_feed_id": str(feed["_id"]), "synced_at": now.isoformat(),
                }
                res = await db.reservations.update_one(
                    {"ical_uid": uid, "property_id": feed["property_id"]},
                    {"$set": doc, "$setOnInsert": {"created_at": now.isoformat()}},
                    upsert=True,
                )
                if res.upserted_id:
                    imported += 1
            await db.ical_feeds.update_one({"_id": feed["_id"]}, {"$set": {"last_sync_at": now.isoformat(), "last_sync_count": imported, "last_error": ""}})
            logger.info(f"[scheduler] synced iCal feed {feed.get('label')}: {imported} new reservations")
        except Exception as e:
            logger.warning(f"[scheduler] iCal sync failed for {feed.get('label')}: {e}")
            try:
                await db.ical_feeds.update_one({"_id": feed["_id"]}, {"$set": {"last_error": str(e)[:200], "last_sync_at": now.isoformat()}})
            except Exception:
                pass

async def _scheduler_loop(db):
    logger.info(f"[scheduler] iCal sync every {SYNC_INTERVAL_MIN} min")
    # Run once at startup after a short delay
    await asyncio.sleep(30)
    while True:
        try:
            await _sync_all_ical(db)
        except Exception as e:
            logger.error(f"[scheduler] loop error: {e}")
        await asyncio.sleep(SYNC_INTERVAL_MIN * 60)

def start_scheduler(db):
    global _task
    if _task and not _task.done():
        return
    try:
        loop = asyncio.get_event_loop()
        _task = loop.create_task(_scheduler_loop(db))
        logger.info("[scheduler] started")
    except Exception as e:
        logger.warning(f"[scheduler] not started: {e}")

def stop_scheduler():
    global _task
    if _task:
        _task.cancel()
        _task = None

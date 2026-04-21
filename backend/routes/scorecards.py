"""Enhanced Cleaner Scorecard with Photo Metrics.

Aggregates per-cleaner: jobs done, avg completion time, photo coverage (photos per task),
notes written, issues reported, average quality rating.
"""
from fastapi import APIRouter, Request, HTTPException
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone, timedelta
from bson import ObjectId

router = APIRouter(prefix="/api/scorecards", tags=["scorecards"])

def get_db(request: Request):
    return request.app.state.db

@router.get("/cleaners")
async def cleaner_scorecards(request: Request, days: int = 30):
    """Return per-cleaner performance metrics for the last N days."""
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")

    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cleaners = await db.users.find({"role": "cleaner"}).to_list(200)
    out = []
    for c in cleaners:
        cid = str(c["_id"])
        turnovers = await db.turnovers.find({"assigned_cleaner_id": cid, "created_at": {"$gte": since}}).to_list(500)
        completed = [t for t in turnovers if t.get("status") == "completed"]
        # Avg completion duration
        durations = []
        for t in completed:
            try:
                if t.get("started_at") and t.get("completed_at"):
                    start = datetime.fromisoformat(t["started_at"].replace("Z", "+00:00"))
                    end = datetime.fromisoformat(t["completed_at"].replace("Z", "+00:00"))
                    durations.append((end - start).total_seconds() / 60)
            except Exception:
                pass
        avg_duration = round(sum(durations) / len(durations)) if durations else 0

        # Photo count in checklist_items for this cleaner's turnovers
        turnover_ids = [str(t["_id"]) for t in turnovers]
        photo_count = 0
        tasks_with_photos = 0
        total_tasks = 0
        notes_count = 0
        issues_reported = 0
        if turnover_ids:
            # media attached to checklist items
            items = await db.checklist_items.find({"turnover_id": {"$in": turnover_ids}}).to_list(5000)
            item_ids = [str(it["_id"]) for it in items]
            total_tasks = len(items)
            if item_ids:
                media = await db.media.find({"owner_type": "checklist_item", "owner_id": {"$in": item_ids}, "media_type": "photo"}).to_list(5000)
                photo_count = len(media)
                items_with_media = set(m.get("owner_id") for m in media)
                tasks_with_photos = len(items_with_media)

            # Notes tied to these turnovers
            notes = await db.task_notes.find({"turnover_id": {"$in": turnover_ids}}).to_list(5000) if hasattr(db, "task_notes") else []
            notes_count = len(notes) if notes else 0

            # Issues reported by this cleaner during these turnovers
            issues = await db.issues.find({"source_user_id": cid, "created_at": {"$gte": since}}).to_list(5000)
            issues_reported = len(issues)

        photo_coverage = round((tasks_with_photos / total_tasks * 100)) if total_tasks else 0
        avg_rating = 0
        ratings = [t.get("quality_rating") for t in completed if t.get("quality_rating")]
        if ratings:
            avg_rating = round(sum(ratings) / len(ratings), 1)

        out.append({
            "cleaner_id": cid,
            "cleaner_name": f"{c.get('first_name', '')} {c.get('last_name', '')}".strip(),
            "cleaner_email": c.get("email", ""),
            "turnovers_assigned": len(turnovers),
            "turnovers_completed": len(completed),
            "avg_duration_min": avg_duration,
            "photos_taken": photo_count,
            "tasks_completed": total_tasks,
            "photo_coverage_pct": photo_coverage,
            "notes_written": notes_count,
            "issues_reported": issues_reported,
            "avg_quality_rating": avg_rating,
            "performance_score": min(100, round((photo_coverage * 0.4) + (min(len(completed) * 5, 50)) + (avg_rating * 10 if avg_rating else 0) / 5)),
        })

    out.sort(key=lambda x: x["performance_score"], reverse=True)
    return {"since": since, "days": days, "cleaners": out}

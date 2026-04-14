from fastapi import APIRouter, Request
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

def get_db(request: Request):
    return request.app.state.db

@router.get("")
async def list_notifications(request: Request, unread: bool = False):
    db = get_db(request)
    user = await get_current_user(request, db)
    query = {"user_id": user["id"]}
    if unread:
        query["read_at"] = None
    notifications = await db.notifications.find(query).sort("created_at", -1).limit(50).to_list(50)
    return serialize_doc(notifications)

@router.get("/count")
async def unread_count(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    count = await db.notifications.count_documents({"user_id": user["id"], "read_at": None})
    return {"unread_count": count}

@router.put("/{notification_id}/read")
async def mark_read(notification_id: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "user_id": user["id"]},
        {"$set": {"read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True}

@router.put("/read-all")
async def mark_all_read(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    await db.notifications.update_many(
        {"user_id": user["id"], "read_at": None},
        {"$set": {"read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True}


async def create_notification(db, user_id: str, notif_type: str, title: str, body: str, action_url: str = ""):
    """Helper to create a notification for a user."""
    await db.notifications.insert_one({
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "action_url": action_url,
        "read_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def notify_admins(db, notif_type: str, title: str, body: str, action_url: str = ""):
    """Send notification to all property managers and admins."""
    admins = await db.users.find({"role": {"$in": ["property_manager", "super_admin", "operations_manager"]}}).to_list(50)
    for admin in admins:
        await create_notification(db, str(admin["_id"]), notif_type, title, body, action_url)

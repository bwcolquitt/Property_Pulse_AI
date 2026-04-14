from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
from bson import ObjectId
import base64
import uuid

router = APIRouter(prefix="/api/media", tags=["media"])

def get_db(request: Request):
    return request.app.state.db

class MediaUpload(BaseModel):
    owner_type: str  # issue, turnover, inspection, property
    owner_id: str
    media_type: str = "photo"  # photo, video
    base64_data: str
    filename: Optional[str] = None

@router.post("/upload")
async def upload_media(input: MediaUpload, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    # Store base64 directly in MongoDB for mobile compatibility
    file_id = str(uuid.uuid4())
    doc = {
        "file_id": file_id,
        "owner_type": input.owner_type,
        "owner_id": input.owner_id,
        "media_type": input.media_type,
        "base64_data": input.base64_data,
        "filename": input.filename or f"{file_id}.jpg",
        "file_url": f"/api/media/{file_id}",
        "thumbnail_url": f"/api/media/{file_id}",
        "uploaded_by_user_id": user["id"],
        "uploaded_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.media.insert_one(doc)
    return {
        "id": str(result.inserted_id),
        "file_id": file_id,
        "file_url": doc["file_url"],
        "media_type": input.media_type,
        "owner_type": input.owner_type,
        "owner_id": input.owner_id,
        "created_at": doc["created_at"],
    }

@router.get("/{file_id}")
async def get_media(file_id: str, request: Request):
    db = get_db(request)
    media = await db.media.find_one({"file_id": file_id})
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    from fastapi.responses import Response
    try:
        data = base64.b64decode(media["base64_data"])
        content_type = "image/jpeg" if media.get("media_type") == "photo" else "video/mp4"
        return Response(content=data, media_type=content_type)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decode media")

@router.get("/list/{owner_type}/{owner_id}")
async def list_media(owner_type: str, owner_id: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    media = await db.media.find(
        {"owner_type": owner_type, "owner_id": owner_id},
        {"base64_data": 0, "_id": 0}  # Exclude base64 data and _id for listing
    ).to_list(100)
    return media

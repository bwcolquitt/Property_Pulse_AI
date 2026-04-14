from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])

def get_db(request: Request):
    return request.app.state.db

class JobPostCreate(BaseModel):
    property_id: str
    job_type: str = "cleaning"
    title: str
    description: str = ""
    urgency: str = "normal"
    due_at: Optional[str] = None
    budget_amount: Optional[float] = None

@router.get("/providers")
async def list_providers(request: Request, service_type: Optional[str] = None):
    db = get_db(request)
    user = await get_current_user(request, db)
    query = {"profile_status": "active"}
    if service_type:
        query["provider_type"] = service_type
    providers = await db.providers.find(query).to_list(100)
    result = []
    for p in providers:
        doc = serialize_doc(p)
        # Get services
        services = await db.provider_services.find({"provider_id": str(p["_id"])}).to_list(20)
        doc["services"] = serialize_doc(services)
        # Get areas
        areas = await db.provider_service_areas.find({"provider_id": str(p["_id"])}).to_list(20)
        doc["service_areas"] = serialize_doc(areas)
        result.append(doc)
    return result

@router.get("/providers/{provider_id}")
async def get_provider(provider_id: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    provider = await db.providers.find_one({"_id": ObjectId(provider_id)})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    doc = serialize_doc(provider)
    doc["services"] = serialize_doc(await db.provider_services.find({"provider_id": provider_id}).to_list(20))
    doc["service_areas"] = serialize_doc(await db.provider_service_areas.find({"provider_id": provider_id}).to_list(20))
    doc["documents"] = serialize_doc(await db.provider_documents.find({"provider_id": provider_id}, {"_id": 0}).to_list(20))
    return doc

@router.get("/jobs")
async def list_jobs(request: Request, status: Optional[str] = None):
    db = get_db(request)
    user = await get_current_user(request, db)
    query = {}
    if status:
        query["status"] = status
    jobs = await db.job_posts.find(query).sort("created_at", -1).to_list(100)
    return serialize_doc(jobs)

@router.post("/jobs")
async def create_job(input: JobPostCreate, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    doc = {
        **input.dict(),
        "organization_id": None,
        "issue_id": None,
        "turnover_id": None,
        "status": "open",
        "broadcast_scope": "all",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.job_posts.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc

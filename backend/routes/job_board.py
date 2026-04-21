from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/jobs", tags=["jobs"])

def get_db(request: Request):
    return request.app.state.db

class JobCreate(BaseModel):
    property_id: str
    title: str
    description: str = ""
    job_type: str = "cleaning"  # cleaning, maintenance, pool, deep_clean
    urgency: str = "normal"  # normal, urgent, emergency
    due_at: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    requirements: str = ""

class BidCreate(BaseModel):
    amount: float
    estimated_hours: float = 0
    message: str = ""
    available_date: str = ""

class BidAction(BaseModel):
    action: str  # accept, reject

@router.get("")
async def list_jobs(request: Request, status: Optional[str] = None, job_type: Optional[str] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    query = {}
    if status:
        query["status"] = status
    if job_type:
        query["job_type"] = job_type
    jobs = await db.job_posts.find(query).sort("created_at", -1).to_list(100)
    result = []
    for j in jobs:
        doc = serialize_doc(j)
        # Enrich with property info
        if j.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(j["property_id"])})
                doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
            except:
                doc["property_name"] = ""
        # Count bids
        bid_count = await db.job_bids.count_documents({"job_id": str(j["_id"])})
        doc["bid_count"] = bid_count
        result.append(doc)
    return result

@router.post("")
async def create_job(input: JobCreate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "property_id": input.property_id,
        "title": input.title,
        "description": input.description,
        "job_type": input.job_type,
        "urgency": input.urgency,
        "due_at": input.due_at,
        "budget_min": input.budget_min,
        "budget_max": input.budget_max,
        "requirements": input.requirements,
        "status": "open",
        "posted_by": user["id"],
        "posted_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
        "accepted_bid_id": None,
        "accepted_provider_id": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.job_posts.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@router.get("/{job_id}")
async def get_job(job_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    job = await db.job_posts.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    doc = serialize_doc(job)
    if job.get("property_id"):
        try:
            prop = await db.properties.find_one({"_id": ObjectId(job["property_id"])})
            doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
        except:
            doc["property_name"] = ""
    # Get bids
    bids = await db.job_bids.find({"job_id": job_id}).sort("created_at", 1).to_list(50)
    enriched_bids = []
    for b in bids:
        bd = serialize_doc(b)
        if b.get("provider_id"):
            try:
                prov = await db.providers.find_one({"_id": ObjectId(b["provider_id"])})
                bd["provider_name"] = prov.get("company_name", "") if prov else "Unknown"
                bd["provider_rating"] = prov.get("base_rating", 0) if prov else 0
            except:
                bd["provider_name"] = "Unknown"
                bd["provider_rating"] = 0
        enriched_bids.append(bd)
    doc["bids"] = enriched_bids
    return doc

@router.post("/{job_id}/bids")
async def submit_bid(job_id: str, input: BidCreate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    # Find provider by user_id
    provider = await db.providers.find_one({"user_id": user["id"]})
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "job_id": job_id,
        "provider_id": str(provider["_id"]) if provider else None,
        "bidder_user_id": user["id"],
        "bidder_name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
        "amount": input.amount,
        "estimated_hours": input.estimated_hours,
        "message": input.message,
        "available_date": input.available_date,
        "status": "pending",
        "created_at": now,
    }
    result = await db.job_bids.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    # Update bid count
    await db.job_posts.update_one({"_id": ObjectId(job_id)}, {"$set": {"updated_at": now}})
    return doc

@router.put("/{job_id}/bids/{bid_id}")
async def action_bid(job_id: str, bid_id: str, input: BidAction, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    
    if input.action == "accept":
        bid = await db.job_bids.find_one({"_id": ObjectId(bid_id)})
        if not bid:
            raise HTTPException(status_code=404, detail="Bid not found")
        # Accept this bid
        await db.job_bids.update_one({"_id": ObjectId(bid_id)}, {"$set": {"status": "accepted"}})
        # Reject other bids
        await db.job_bids.update_many(
            {"job_id": job_id, "_id": {"$ne": ObjectId(bid_id)}},
            {"$set": {"status": "rejected"}}
        )
        # Update job
        await db.job_posts.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "awarded", "accepted_bid_id": bid_id, "accepted_provider_id": bid.get("provider_id"), "updated_at": now}}
        )
    elif input.action == "reject":
        await db.job_bids.update_one({"_id": ObjectId(bid_id)}, {"$set": {"status": "rejected"}})
    
    return {"success": True}

@router.put("/{job_id}/close")
async def close_job(job_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    await db.job_posts.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {"status": "closed", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True}

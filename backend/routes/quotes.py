from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/marketplace/quotes", tags=["quotes"])

def get_db(request: Request):
    return request.app.state.db

class QuoteCreate(BaseModel):
    job_post_id: str
    amount: float
    note: str = ""

class QuoteAction(BaseModel):
    action: str  # accept, reject

@router.get("/{job_post_id}")
async def list_quotes(job_post_id: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    quotes = await db.quotes.find({"job_post_id": job_post_id}).sort("created_at", -1).to_list(50)
    result = []
    for q in quotes:
        doc = serialize_doc(q)
        if q.get("provider_id"):
            try:
                provider = await db.providers.find_one({"_id": ObjectId(q["provider_id"])})
                doc["provider_name"] = provider.get("company_name", "") if provider else "Unknown"
                doc["provider_rating"] = provider.get("base_rating", 0) if provider else 0
            except Exception:
                doc["provider_name"] = "Unknown"
                doc["provider_rating"] = 0
        result.append(doc)
    return result

@router.post("")
async def submit_quote(input: QuoteCreate, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    # Find provider for this user
    provider = await db.providers.find_one({"user_id": user["id"]})
    provider_id = str(provider["_id"]) if provider else None
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "job_post_id": input.job_post_id,
        "provider_id": provider_id,
        "user_id": user["id"],
        "amount": input.amount,
        "note": input.note,
        "status": "pending",
        "created_at": now,
    }
    result = await db.quotes.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc

@router.put("/{quote_id}")
async def action_quote(quote_id: str, input: QuoteAction, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc).isoformat()
    if input.action == "accept":
        await db.quotes.update_one({"_id": ObjectId(quote_id)}, {"$set": {"status": "accepted", "accepted_at": now}})
        # Reject all other quotes for same job
        quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
        if quote:
            await db.quotes.update_many({"job_post_id": quote["job_post_id"], "_id": {"$ne": ObjectId(quote_id)}}, {"$set": {"status": "rejected"}})
            await db.job_posts.update_one({"_id": ObjectId(quote["job_post_id"])}, {"$set": {"status": "awarded"}})
    elif input.action == "reject":
        await db.quotes.update_one({"_id": ObjectId(quote_id)}, {"$set": {"status": "rejected"}})
    return {"success": True}

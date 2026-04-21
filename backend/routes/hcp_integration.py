"""Housecall Pro (HCP) Integration - Create estimates and jobs from Property Pulse issues.

HCP is used by many home service businesses. This stub stores credentials and provides
endpoints to create estimates from existing issues. Real API calls are implemented
when api_key is configured; otherwise returns simulated success.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
from bson import ObjectId
import httpx

router = APIRouter(prefix="/api/hcp", tags=["hcp"])

def get_db(request: Request):
    return request.app.state.db

@router.get("/config")
async def get_config(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    config = await db.hcp_config.find_one({}) or {}
    if config.get("api_key"):
        v = config["api_key"]
        config["api_key_masked"] = (v[:3] + "****" + v[-3:]) if len(v) > 6 else "****"
        config.pop("api_key", None)
    config.pop("_id", None)
    return config or {"enabled": False}

class HcpConfigInput(BaseModel):
    api_key: Optional[str] = ""
    default_employee_id: Optional[str] = ""
    enabled: bool = True

@router.put("/config")
async def update_config(input: HcpConfigInput, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    updates = {k: v for k, v in input.dict(exclude_unset=True).items() if v not in (None, "")}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.hcp_config.update_one({}, {"$set": updates}, upsert=True)
    return {"success": True}

class CreateEstimateInput(BaseModel):
    issue_id: str
    customer_name: str = ""
    customer_email: str = ""
    customer_phone: str = ""
    estimate_total: float = 0
    notes: str = ""

@router.post("/estimate-from-issue")
async def create_estimate(input: CreateEstimateInput, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    issue = await db.issues.find_one({"_id": ObjectId(input.issue_id)})
    if not issue:
        raise HTTPException(404, "Issue not found")

    config = await db.hcp_config.find_one({}) or {}
    api_key = config.get("api_key")
    enabled = config.get("enabled", False)
    now = datetime.now(timezone.utc).isoformat()

    if not enabled or not api_key:
        # Simulated
        est_id = f"SIM-EST-{int(datetime.now().timestamp())}"
        await db.issues.update_one({"_id": ObjectId(input.issue_id)}, {"$set": {"hcp_estimate_id": est_id, "hcp_estimate_status": "simulated", "hcp_estimate_total": input.estimate_total}})
        return {"success": True, "simulated": True, "estimate_id": est_id, "message": "HCP estimate simulated. Configure HCP API key to create real estimates."}

    # Real HCP call (v1 API)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.housecallpro.com/estimates",
                headers={"Authorization": f"Token {api_key}", "Content-Type": "application/json"},
                json={
                    "customer": {"first_name": input.customer_name.split(" ")[0] if input.customer_name else "Guest", "last_name": " ".join(input.customer_name.split(" ")[1:]) if input.customer_name else "", "email": input.customer_email, "mobile_number": input.customer_phone},
                    "description": f"{issue.get('title', '')} — {issue.get('description', '')}\n\n{input.notes}"[:1000],
                    "line_items": [{"name": issue.get("title", "Service"), "unit_price": int(input.estimate_total * 100), "quantity": 1}] if input.estimate_total else [],
                },
            )
            if r.status_code in (200, 201):
                resp = r.json()
                est_id = resp.get("id", "")
                await db.issues.update_one({"_id": ObjectId(input.issue_id)}, {"$set": {"hcp_estimate_id": est_id, "hcp_estimate_status": "created", "hcp_estimate_total": input.estimate_total, "hcp_estimate_created_at": now}})
                return {"success": True, "estimate_id": est_id, "message": "Estimate created in Housecall Pro"}
            return {"success": False, "message": f"HCP: {r.status_code} {r.text[:200]}"}
    except Exception as e:
        return {"success": False, "message": f"HCP error: {e}"}

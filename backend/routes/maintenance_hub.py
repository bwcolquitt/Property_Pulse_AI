from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/maintenance-hub", tags=["maintenance-hub"])

def get_db(request: Request):
    return request.app.state.db

OUTSTANDING = ["new", "not_started", "assigned", "in_progress", "awaiting_approval", "awaiting_parts", "scheduled", "blocked", "reopened"]

@router.get("/outstanding")
async def outstanding_issues(request: Request, priority: Optional[str] = None, property_id: Optional[str] = None):
    tdb, user = await get_tenant_db(request)
    db = tdb
    query = {"status": {"$in": OUTSTANDING}}
    if priority:
        query["priority"] = priority
    if property_id:
        query["property_id"] = property_id
    issues = await db.issues.find(query).sort([("priority", -1), ("created_at", -1)]).to_list(200)
    result = []
    for i in issues:
        doc = serialize_doc(i)
        if i.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(i["property_id"])})
                doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
            except: doc["property_name"] = ""
        doc["photos"] = i.get("photos", [])
        result.append(doc)
    return result

@router.get("/stats")
async def maintenance_stats(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    total_open = await db.issues.count_documents({"status": {"$in": OUTSTANDING}})
    urgent = await db.issues.count_documents({"status": {"$in": OUTSTANDING}, "priority": "urgent"})
    high = await db.issues.count_documents({"status": {"$in": OUTSTANDING}, "priority": "high"})
    blocked = await db.issues.count_documents({"status": "blocked"})
    not_started = await db.issues.count_documents({"status": {"$in": ["new", "not_started"]}})
    in_progress = await db.issues.count_documents({"status": "in_progress"})
    return {"total_open": total_open, "urgent": urgent, "high": high, "blocked": blocked, "not_started": not_started, "in_progress": in_progress}

@router.get("/{issue_id}")
async def get_issue_detail(issue_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    issue = await db.issues.find_one({"_id": ObjectId(issue_id)})
    if not issue: raise HTTPException(404, "Issue not found")
    doc = serialize_doc(issue)
    if issue.get("property_id"):
        try:
            prop = await db.properties.find_one({"_id": ObjectId(issue["property_id"])})
            doc["property_name"] = prop.get("nickname", prop.get("name", "")) if prop else ""
        except: doc["property_name"] = ""
    doc["photos"] = issue.get("photos", [])
    return doc

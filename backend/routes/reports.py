from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId
import io, csv

router = APIRouter(prefix="/api/reports", tags=["reports"])

def get_db(request: Request):
    return request.app.state.db

OUTSTANDING_STATUSES = ["new", "not_started", "assigned", "in_progress", "awaiting_approval", "awaiting_parts", "scheduled", "blocked", "reopened"]

@router.get("")
async def get_report_types(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    return [
        {"id": "outstanding_maintenance", "name": "Outstanding Maintenance", "description": "All open maintenance issues with priority breakdown"},
        {"id": "guest_readiness", "name": "Guest Readiness", "description": "Property readiness for upcoming guests"},
        {"id": "turnover_completion", "name": "Turnover Completion", "description": "Turnover completion rates and times"},
        {"id": "cleaner_scorecard", "name": "Cleaner Scorecard", "description": "Cleaner performance metrics and ratings"},
        {"id": "issue_trends", "name": "Issue Trends by Property", "description": "Issue trends across properties"},
        {"id": "vendor_performance", "name": "Vendor Performance", "description": "Vendor scorecards and metrics"},
        {"id": "financial_summary", "name": "Financial Summary", "description": "Revenue, maintenance costs, and budgets"},
    ]

@router.get("/outstanding-maintenance")
async def outstanding_maintenance_report(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    issues = await db.issues.find({"status": {"$in": OUTSTANDING_STATUSES}}).to_list(500)
    return serialize_doc(issues)

@router.get("/guest-readiness")
async def guest_readiness_report(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    properties = await db.properties.find({"status": "active"}).to_list(100)
    result = []
    for p in properties:
        pid = str(p["_id"])
        open_issues = await db.issues.count_documents({"property_id": pid, "status": {"$in": OUTSTANDING_STATUSES}})
        blocking_issues = await db.issues.count_documents({"property_id": pid, "blocks_check_in": True, "status": {"$in": OUTSTANDING_STATUSES}})
        active_turnovers = await db.turnovers.count_documents({"property_id": pid, "status": {"$nin": ["completed"]}})
        doc = serialize_doc(p)
        doc["open_issues"] = open_issues
        doc["blocking_issues"] = blocking_issues
        doc["active_turnovers"] = active_turnovers
        doc["ready"] = open_issues == 0 and blocking_issues == 0
        result.append(doc)
    return result

@router.get("/turnover-completion")
async def turnover_completion_report(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    turnovers = await db.turnovers.find().sort("due_at", -1).to_list(200)
    return serialize_doc(turnovers)

@router.get("/team")
async def team_report(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    users = await db.users.find({}, {"password_hash": 0}).to_list(100)
    result = []
    for u in users:
        doc = serialize_doc(u)
        doc["assigned_turnovers"] = await db.turnovers.count_documents({"assigned_provider_id": str(u["_id"])})
        doc["assigned_issues"] = await db.issues.count_documents({"assigned_provider_id": str(u["_id"])})
        result.append(doc)
    return result


@router.get("/cleaner-scorecard")
async def cleaner_scorecard_report(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    cleaners = await db.users.find({"role": {"$in": ["cleaner", "maintenance_technician"]}}, {"password_hash": 0}).to_list(50)
    result = []
    for c in cleaners:
        cid = str(c["_id"])
        completed_turnovers = await db.turnovers.count_documents({"assigned_provider_id": cid, "status": "completed"})
        active_turnovers = await db.turnovers.count_documents({"assigned_provider_id": cid, "status": {"$nin": ["completed", "cancelled"]}})
        issues_reported = await db.issues.count_documents({"source_user_id": cid})
        doc = serialize_doc(c)
        doc["completed_turnovers"] = completed_turnovers
        doc["active_turnovers"] = active_turnovers
        doc["issues_reported"] = issues_reported
        doc["score"] = min(100, completed_turnovers * 10 + 50) if completed_turnovers > 0 else 50
        result.append(doc)
    return result

@router.get("/vendor-performance")
async def vendor_performance_report(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    providers = await db.providers.find({"profile_status": "active"}).to_list(50)
    result = []
    for p in providers:
        pid = str(p["_id"])
        doc = serialize_doc(p)
        completed_jobs = await db.job_posts.count_documents({"accepted_provider_id": pid, "status": "closed"})
        active_jobs = await db.job_posts.count_documents({"accepted_provider_id": pid, "status": {"$ne": "closed"}})
        doc["completed_jobs"] = completed_jobs
        doc["active_jobs"] = active_jobs
        result.append(doc)
    return result

@router.get("/issue-trends")
async def issue_trends_report(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    properties = await db.properties.find({"status": "active"}).to_list(100)
    result = []
    for p in properties:
        pid = str(p["_id"])
        total_issues = await db.issues.count_documents({"property_id": pid})
        open_issues = await db.issues.count_documents({"property_id": pid, "status": {"$in": OUTSTANDING_STATUSES}})
        urgent_issues = await db.issues.count_documents({"property_id": pid, "priority": "urgent", "status": {"$in": OUTSTANDING_STATUSES}})
        by_trade = {}
        issues = await db.issues.find({"property_id": pid}).to_list(200)
        for iss in issues:
            trade = iss.get("trade_type", "other")
            by_trade[trade] = by_trade.get(trade, 0) + 1
        doc = serialize_doc(p)
        doc["total_issues"] = total_issues
        doc["open_issues"] = open_issues
        doc["urgent_issues"] = urgent_issues
        doc["by_trade"] = by_trade
        result.append(doc)
    return result

@router.get("/financial-summary")
async def financial_summary_report(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    issues = await db.issues.find({}).to_list(500)
    total_estimated = sum(i.get("estimate_amount", 0) or 0 for i in issues)
    approved_costs = sum(i.get("estimate_amount", 0) or 0 for i in issues if i.get("estimate_status") == "approved")
    pending_costs = sum(i.get("estimate_amount", 0) or 0 for i in issues if i.get("estimate_status") == "pending")
    by_trade = {}
    for i in issues:
        trade = i.get("trade_type", "other")
        amount = i.get("estimate_amount", 0) or 0
        by_trade[trade] = by_trade.get(trade, 0) + amount
    return {
        "total_estimated": total_estimated,
        "approved_costs": approved_costs,
        "pending_costs": pending_costs,
        "by_trade": by_trade,
        "issue_count": len(issues),
    }

@router.get("/export/{report_id}")
async def export_report_csv(report_id: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    if report_id == "outstanding_maintenance":
        writer.writerow(["Title", "Property", "Priority", "Status", "Trade", "Estimate", "Due Date"])
        issues = await db.issues.find({"status": {"$in": OUTSTANDING_STATUSES}}).to_list(500)
        for i in issues:
            prop_name = ""
            if i.get("property_id"):
                try:
                    prop = await db.properties.find_one({"_id": ObjectId(i["property_id"])})
                    prop_name = prop.get("nickname", prop.get("name", "")) if prop else ""
                except: pass
            writer.writerow([i.get("title", ""), prop_name, i.get("priority", ""), i.get("status", ""), i.get("trade_type", ""), i.get("estimate_amount", ""), i.get("due_at", "")])
    
    elif report_id == "turnover_completion":
        writer.writerow(["Title", "Property", "Status", "Due Date", "Readiness Score", "Risk Level"])
        turnovers = await db.turnovers.find().sort("due_at", -1).to_list(200)
        for t in turnovers:
            prop_name = ""
            if t.get("property_id"):
                try:
                    prop = await db.properties.find_one({"_id": ObjectId(t["property_id"])})
                    prop_name = prop.get("nickname", prop.get("name", "")) if prop else ""
                except: pass
            writer.writerow([t.get("title", ""), prop_name, t.get("status", ""), t.get("due_at", ""), t.get("readiness_score", ""), t.get("risk_level", "")])
    
    elif report_id == "guest_readiness":
        writer.writerow(["Property", "Address", "Open Issues", "Blocking Issues", "Ready"])
        properties = await db.properties.find({"status": "active"}).to_list(100)
        for p in properties:
            pid = str(p["_id"])
            open_i = await db.issues.count_documents({"property_id": pid, "status": {"$in": OUTSTANDING_STATUSES}})
            blocking = await db.issues.count_documents({"property_id": pid, "blocks_check_in": True, "status": {"$in": OUTSTANDING_STATUSES}})
            writer.writerow([p.get("nickname", p.get("name", "")), p.get("address_1", ""), open_i, blocking, "Yes" if open_i == 0 else "No"])
    
    else:
        writer.writerow(["Report not available for CSV export"])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={report_id}_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

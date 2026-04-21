from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from emergentintegrations.llm.chat import LlmChat, UserMessage
import os, json, logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai-smart", tags=["ai-smart"])

def get_db(request: Request):
    return request.app.state.db

def get_llm(session_id: str = "smart"):
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI not configured")
    chat = LlmChat(api_key=api_key, session_id=f"pp-{session_id}-{datetime.now().timestamp()}", system_message="You are PropertyPulse AI, an expert short-term rental operations assistant. Always respond with valid JSON.")
    chat.with_model("openai", "gpt-5.2")
    return chat

class AutoScheduleRequest(BaseModel):
    property_id: Optional[str] = None
    date_range_days: int = 7

class IssuePatternRequest(BaseModel):
    property_id: Optional[str] = None

class SmartNotifRequest(BaseModel):
    user_id: Optional[str] = None

@router.post("/auto-schedule")
async def ai_auto_schedule(input: AutoScheduleRequest, request: Request):
    """AI suggests optimal scheduling for turnovers and services to avoid conflicts."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=input.date_range_days)

    turnovers = await db.turnovers.find({"due_at": {"$lte": end.isoformat()}, "status": {"$nin": ["completed"]}}).sort("due_at", 1).to_list(50)
    providers_list = await db.providers.find({"profile_status": "active"}).to_list(20)
    issues = await db.issues.find({"status": {"$in": ["new", "assigned", "scheduled"]}}).to_list(50)

    turnovers_summary = []
    for t in turnovers:
        prop = None
        if t.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(t["property_id"])})
            except: pass
        turnovers_summary.append({
            "id": str(t["_id"]), "title": t.get("title", ""),
            "property": prop.get("nickname", prop.get("name", "")) if prop else "",
            "due_at": t.get("due_at", ""), "status": t.get("status", ""),
            "assigned": t.get("assigned_provider_id") is not None,
        })

    providers_summary = [{"id": str(p["_id"]), "name": p.get("company_name", ""), "type": p.get("provider_type", ""), "team_size": p.get("team_size", 1), "emergency": p.get("emergency_available", False)} for p in providers_list]
    issues_summary = [{"title": i.get("title", ""), "priority": i.get("priority", ""), "trade": i.get("trade_type", ""), "property_id": i.get("property_id", "")} for i in issues[:15]]

    try:
        chat = get_llm("schedule")
        prompt = f"""Optimize the schedule for these vacation rental turnovers and open maintenance issues.

Turnovers (next {input.date_range_days} days): {json.dumps(turnovers_summary)}
Available Providers: {json.dumps(providers_summary)}
Open Issues: {json.dumps(issues_summary)}

Rules:
- Cleaners should arrive AFTER checkout time, finish BEFORE check-in
- Maintenance should be scheduled to not block cleaning
- Pool/spa service can overlap with indoor cleaning
- Prioritize properties with upcoming guests
- Group nearby properties for the same provider to reduce travel

Return JSON with:
- schedule: array of objects [{{
    "turnover_id": string,
    "property": string,
    "recommended_services": [{{
      "service_type": string,
      "suggested_provider": string,
      "suggested_start": string (time),
      "suggested_end": string (time),
      "reason": string
    }}],
    "conflicts": [string],
    "optimization_notes": string
  }}]
- overall_efficiency_score: number 0-100
- recommendations: [string] (top 3 scheduling tips)"""

        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        text = response.strip()
        if "```json" in text: text = text.split("```json")[1].split("```")[0]
        elif "```" in text: text = text.split("```")[1].split("```")[0]
        result = json.loads(text)
        result["generated_at"] = now.isoformat()
        return result
    except Exception as e:
        logger.error(f"Auto-schedule error: {e}")
        return {"schedule": [], "overall_efficiency_score": 0, "recommendations": ["AI scheduling unavailable"], "error": str(e)}

@router.post("/issue-patterns")
async def detect_issue_patterns(input: IssuePatternRequest, request: Request):
    """AI analyzes historical issues to detect recurring patterns and predict future problems."""
    tdb, user = await get_tenant_db(request)
    db = tdb

    query = {}
    if input.property_id: query["property_id"] = input.property_id
    issues = await db.issues.find(query).sort("created_at", -1).limit(100).to_list(100)

    issues_data = [{"title": i.get("title", ""), "trade": i.get("trade_type", ""), "priority": i.get("priority", ""), "location": i.get("location_in_property", ""), "property_id": i.get("property_id", ""), "reopened": i.get("reopened_count", 0), "status": i.get("status", ""), "created": i.get("created_at", "")} for i in issues]

    try:
        chat = get_llm("patterns")
        prompt = f"""Analyze these {len(issues)} maintenance issues from a vacation rental portfolio and identify patterns.

Issues: {json.dumps(issues_data[:50])}

Return JSON with:
- recurring_patterns: [{{ "pattern": string, "frequency": string, "affected_properties": [string], "trade_type": string, "severity": "high"|"medium"|"low" }}]
- predictive_alerts: [{{ "prediction": string, "probability": "high"|"medium"|"low", "recommended_action": string, "estimated_cost": number }}]
- preventive_recommendations: [{{ "recommendation": string, "priority": string, "estimated_savings": string }}]
- property_risk_ranking: [{{ "property_id": string, "risk_score": number, "top_issue_category": string }}]
- summary: string (2-3 sentences)"""

        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        text = response.strip()
        if "```json" in text: text = text.split("```json")[1].split("```")[0]
        elif "```" in text: text = text.split("```")[1].split("```")[0]
        return json.loads(text)
    except Exception as e:
        logger.error(f"Pattern detection error: {e}")
        return {"recurring_patterns": [], "predictive_alerts": [], "preventive_recommendations": [], "summary": "Analysis unavailable", "error": str(e)}

@router.post("/predictive-inventory")
async def predictive_inventory(request: Request):
    """AI predicts inventory needs based on upcoming turnovers and usage patterns."""
    tdb, user = await get_tenant_db(request)
    db = tdb

    items = await db.inventory_items_v2.find({"active": True}).to_list(200)
    turnovers = await db.turnovers.find({"status": {"$nin": ["completed"]}}).to_list(20)
    transactions = await db.inventory_transactions.find().sort("created_at", -1).limit(100).to_list(100)

    items_summary = [{"name": i.get("name", ""), "category": i.get("category", ""), "on_hand": i.get("quantity_on_hand", 0), "par": i.get("par_level", 0), "reorder": i.get("reorder_level", 0)} for i in items]
    upcoming = len(turnovers)
    recent_usage = {}
    for t in transactions:
        name = t.get("item_name", "")
        if t.get("quantity_change", 0) < 0:
            recent_usage[name] = recent_usage.get(name, 0) + abs(t["quantity_change"])

    try:
        chat = get_llm("inventory")
        prompt = f"""Predict inventory needs for a vacation rental portfolio.

Current Inventory: {json.dumps(items_summary)}
Upcoming Turnovers: {upcoming}
Recent Usage (last 100 transactions): {json.dumps(recent_usage)}

Return JSON with:
- urgent_reorders: [{{ "item": string, "current_qty": number, "predicted_need": number, "order_qty": number, "urgency": "immediate"|"this_week"|"next_week" }}]
- usage_forecast: [{{ "item": string, "weekly_usage": number, "days_until_stockout": number }}]
- cost_optimization: [{{ "suggestion": string, "potential_savings": string }}]
- shopping_list: [{{ "item": string, "quantity": number, "estimated_cost": number }}]
- total_estimated_cost: number"""

        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        text = response.strip()
        if "```json" in text: text = text.split("```json")[1].split("```")[0]
        elif "```" in text: text = text.split("```")[1].split("```")[0]
        return json.loads(text)
    except Exception as e:
        logger.error(f"Predictive inventory error: {e}")
        return {"urgent_reorders": [], "usage_forecast": [], "shopping_list": [], "error": str(e)}

@router.post("/turnover-debrief")
async def ai_turnover_debrief(request: Request):
    """AI generates a turnover debrief summarizing what happened, issues found, time taken."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    body = await request.json()
    turnover_id = body.get("turnover_id")
    if not turnover_id:
        raise HTTPException(status_code=400, detail="turnover_id required")

    turnover = await db.turnovers.find_one({"_id": ObjectId(turnover_id)})
    if not turnover: raise HTTPException(status_code=404)
    issues = await db.issues.find({"turnover_id": turnover_id}).to_list(20)
    checklist = await db.turnover_checklists.find_one({"turnover_id": turnover_id})
    cl_items = []
    if checklist:
        cl_items = await db.turnover_checklist_items.find({"turnover_checklist_id": str(checklist["_id"])}).to_list(100)

    prop = None
    if turnover.get("property_id"):
        try: prop = await db.properties.find_one({"_id": ObjectId(turnover["property_id"])})
        except: pass

    try:
        chat = get_llm("debrief")
        prompt = f"""Generate a turnover debrief report.

Property: {prop.get('nickname', prop.get('name', '')) if prop else 'Unknown'}
Turnover Status: {turnover.get('status')}
Checklist: {len(cl_items)} tasks, {sum(1 for i in cl_items if i.get('status') == 'completed')} completed
Issues Found: {len(issues)} - {[{'title': i.get('title', ''), 'priority': i.get('priority', ''), 'status': i.get('status', '')} for i in issues]}

Return JSON with:
- summary: string (3-4 sentence executive summary)
- completion_rating: "excellent"|"good"|"needs_improvement"|"poor"
- issues_summary: string
- time_analysis: string
- recommendations: [string] (top 3 for next turnover)
- guest_readiness: boolean
- risk_flags: [string]"""

        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        text = response.strip()
        if "```json" in text: text = text.split("```json")[1].split("```")[0]
        elif "```" in text: text = text.split("```")[1].split("```")[0]
        return json.loads(text)
    except Exception as e:
        return {"summary": "Debrief unavailable", "error": str(e)}

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
from bson import ObjectId
from emergentintegrations.llm.chat import LlmChat, UserMessage
import os, json, logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/issues-v2", tags=["issues-v2"])

def get_db(request: Request):
    return request.app.state.db

class QuickIssueCreate(BaseModel):
    property_id: str
    turnover_id: Optional[str] = None
    title: str
    description: str = ""
    location_in_property: str = ""
    floor: str = ""
    room_name: str = ""
    trade_type: str = "general"
    priority: str = "medium"

class AIEstimateRequest(BaseModel):
    issue_id: str

@router.post("/quick-report")
async def quick_report_issue(input: QuickIssueCreate, request: Request):
    """Quick issue report from checklist - creates issue and notifies admin."""
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc).isoformat()
    
    location = input.location_in_property or f"{input.floor} - {input.room_name}".strip(" -")
    
    doc = {
        "property_id": input.property_id,
        "turnover_id": input.turnover_id,
        "reservation_id": None,
        "issue_type": "maintenance",
        "trade_type": input.trade_type,
        "title": input.title,
        "description": input.description,
        "location_in_property": location,
        "source_type": "checklist",
        "source_user_id": user["id"],
        "priority": input.priority,
        "status": "new",
        "guest_impact_level": "medium",
        "blocks_check_in": False,
        "can_be_done_during_turnover": True,
        "assigned_provider_id": None,
        "estimate_amount": None,
        "estimate_status": None,
        "ai_estimate": None,
        "risk_factor": "medium",
        "complexity": "medium",
        "scheduled_start_at": None,
        "completed_at": None,
        "reopened_count": 0,
        "due_at": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.issues.insert_one(doc)
    issue_id = str(result.inserted_id)
    
    # Status history
    await db.issue_status_history.insert_one({
        "issue_id": issue_id, "old_status": None, "new_status": "new",
        "changed_by_user_id": user["id"], "note": f"Reported from checklist by {user.get('first_name', '')} {user.get('last_name', '')}", "created_at": now,
    })
    
    # Notify admins
    from routes.notifications import notify_admins
    prop = await db.properties.find_one({"_id": ObjectId(input.property_id)})
    prop_name = prop.get("nickname", prop.get("name", "")) if prop else "Unknown"
    await notify_admins(db, "issue_reported", f"New Issue: {input.title}", f"Reported at {prop_name} ({location}) by {user.get('first_name', '')} {user.get('last_name', '')}. Priority: {input.priority}", f"/issue/{issue_id}")
    
    doc["id"] = issue_id
    # Remove ObjectId before returning
    doc.pop("_id", None)
    return doc

@router.post("/ai-estimate")
async def ai_estimate_issue(input: AIEstimateRequest, request: Request):
    """AI-powered cost estimation using GPT-5.2 + company labor rates."""
    db = get_db(request)
    user = await get_current_user(request, db)
    
    issue = await db.issues.find_one({"_id": ObjectId(input.issue_id)})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    # Get company/service rates
    company_settings = await db.service_company_settings.find_one({"trade_type": issue.get("trade_type", "general")})
    if not company_settings:
        company_settings = await db.service_company_settings.find_one({"trade_type": "general"})
    
    labor_rate = company_settings.get("hourly_rate", 65) if company_settings else 65
    markup = company_settings.get("materials_markup", 1.15) if company_settings else 1.15
    
    # Get property info
    prop = None
    if issue.get("property_id"):
        try:
            prop = await db.properties.find_one({"_id": ObjectId(issue["property_id"])})
        except:
            pass
    
    # Get photos count
    photo_count = await db.media.count_documents({"owner_type": "issue", "owner_id": input.issue_id})
    
    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        chat = LlmChat(api_key=api_key, session_id=f"est-{input.issue_id}", system_message="You are a property maintenance estimator AI. Provide accurate cost estimates based on issue details, trade type, and industry standards. Always respond with valid JSON.")
        chat.with_model("openai", "gpt-5.2")
        
        prompt = f"""Estimate repair costs for this vacation rental maintenance issue.

Issue: {issue.get('title', '')}
Description: {issue.get('description', '')}
Location: {issue.get('location_in_property', '')}
Trade Type: {issue.get('trade_type', 'general')}
Priority: {issue.get('priority', 'medium')}
Risk Factor: {issue.get('risk_factor', 'medium')}
Complexity: {issue.get('complexity', 'medium')}
Property: {prop.get('name', '') if prop else 'N/A'} ({prop.get('bedrooms', 0)}BR/{prop.get('bathrooms', 0)}BA)
Photos attached: {photo_count}
Company labor rate: ${labor_rate}/hr
Materials markup: {markup}x

Return JSON with:
- estimated_labor_hours: number (0.5 increments)
- labor_cost: number (labor_hours × ${labor_rate}/hr)
- materials_list: array of objects [{{"item": string, "estimated_cost": number}}]
- materials_total: number
- total_estimate: number (labor + materials with markup)
- confidence: "high" | "medium" | "low"
- reasoning: string (2-3 sentences explaining the estimate)
- suggested_trade: string (plumbing, electrical, general, hvac, appliance, pool)
- estimated_completion_time: string (e.g., "1-2 hours", "30 minutes")
- urgency_recommendation: string"""

        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        
        try:
            text = response.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            estimate = json.loads(text)
        except (json.JSONDecodeError, IndexError):
            # Fallback calculation
            hours = 1.5 if issue.get("complexity") == "medium" else 0.5 if issue.get("complexity") == "low" else 3.0
            estimate = {
                "estimated_labor_hours": hours,
                "labor_cost": hours * labor_rate,
                "materials_list": [{"item": "General supplies", "estimated_cost": 25}],
                "materials_total": 25,
                "total_estimate": round(hours * labor_rate + 25 * markup, 2),
                "confidence": "medium",
                "reasoning": "Estimated based on issue complexity and standard rates.",
                "suggested_trade": issue.get("trade_type", "general"),
                "estimated_completion_time": f"{hours} hours",
                "urgency_recommendation": "Schedule within 48 hours" if issue.get("priority") == "high" else "Schedule at next available"
            }
        
        # Save estimate to issue
        estimate["labor_rate_used"] = labor_rate
        estimate["generated_at"] = datetime.now(timezone.utc).isoformat()
        estimate["generated_by"] = "gpt-5.2"
        
        await db.issues.update_one({"_id": ObjectId(input.issue_id)}, {"$set": {"ai_estimate": estimate, "estimate_amount": estimate.get("total_estimate"), "estimate_status": "ai_pending_review", "updated_at": datetime.now(timezone.utc).isoformat()}})
        
        # Notify admin of AI estimate ready for review
        from routes.notifications import notify_admins
        await notify_admins(db, "ai_estimate_ready", f"AI Estimate Ready: {issue.get('title', '')}", f"Estimated total: ${estimate.get('total_estimate', 0):.2f} ({estimate.get('estimated_labor_hours', 0)}hrs labor + ${estimate.get('materials_total', 0)} materials). Needs review.", f"/issue/{input.issue_id}")
        
        return estimate
    except Exception as e:
        logger.error(f"AI estimate error: {e}")
        raise HTTPException(status_code=500, detail=f"AI estimation failed: {str(e)}")

@router.get("/workflow-hints")
async def get_workflow_hints(request: Request, role: Optional[str] = None):
    """Get smart workflow ordering hints."""
    db = get_db(request)
    user = await get_current_user(request, db)
    query = {}
    if role:
        query["role"] = role
    else:
        # Auto-detect from user role
        if user.get("role") == "cleaner":
            query["role"] = "cleaner"
        elif user.get("role") == "maintenance_technician":
            query["role"] = "maintenance"
    hints = await db.workflow_hints.find(query).sort("priority", 1).to_list(50)
    return serialize_doc(hints)

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
import os
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["ai"])

def get_db(request: Request):
    return request.app.state.db

def get_llm():
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    chat = LlmChat(api_key=api_key, session_id=f"pp-{datetime.now().timestamp()}", system_message="You are PropertyPulse AI, an expert assistant for short-term rental property management. You provide concise, actionable outputs in JSON format.")
    chat.with_model("openai", "gpt-5.2")
    return chat

class ChecklistGenRequest(BaseModel):
    property_type: str = "vacation_rental"
    bedrooms: int = 2
    bathrooms: int = 1
    special_notes: str = ""

class SeverityRequest(BaseModel):
    title: str
    description: str
    location: str = ""
    trade_type: str = ""

class RiskScoreRequest(BaseModel):
    property_id: str

class PredictiveReadinessRequest(BaseModel):
    property_id: Optional[str] = None

@router.post("/generate-checklist")
async def generate_checklist(input: ChecklistGenRequest, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    try:
        chat = get_llm()
        prompt = f"""Generate a detailed cleaning checklist for a {input.property_type} with {input.bedrooms} bedrooms and {input.bathrooms} bathrooms.
{f'Special notes: {input.special_notes}' if input.special_notes else ''}

Return a JSON array of objects with these fields:
- room_name: string (Kitchen, Living Room, Bedroom 1, Bedroom 2, Bathroom 1, etc.)
- title: string (task name)
- description: string (brief guidance)
- requires_photo: boolean
- requires_before_after: boolean
- estimated_minutes: number
- sort_order: number

Include 15-25 tasks covering all rooms. Focus on vacation rental turnover specifics."""

        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        # Parse JSON from response
        try:
            # Try to extract JSON from the response
            text = response.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            checklist = json.loads(text)
        except (json.JSONDecodeError, IndexError):
            checklist = [
                {"room_name": "Kitchen", "title": "Clean countertops", "description": "Wipe all surfaces", "requires_photo": True, "requires_before_after": True, "estimated_minutes": 10, "sort_order": 1},
                {"room_name": "Kitchen", "title": "Clean appliances", "description": "Fridge, microwave, oven", "requires_photo": True, "requires_before_after": False, "estimated_minutes": 15, "sort_order": 2},
                {"room_name": "Living Room", "title": "Vacuum and dust", "description": "All floors and surfaces", "requires_photo": True, "requires_before_after": True, "estimated_minutes": 15, "sort_order": 3},
            ]
        return {"checklist": checklist, "generated_by": "gpt-5.2", "generated_at": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        logger.error(f"AI checklist generation error: {e}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

@router.post("/classify-severity")
async def classify_severity(input: SeverityRequest, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    try:
        chat = get_llm()
        prompt = f"""Classify the severity of this maintenance issue for a short-term rental property.

Title: {input.title}
Description: {input.description}
Location: {input.location}
Trade Type: {input.trade_type}

Return JSON with:
- priority: "urgent" | "high" | "medium" | "low"
- guest_impact_level: "critical" | "high" | "medium" | "low" | "none"
- blocks_check_in: boolean
- estimated_repair_hours: number
- recommended_trade_type: string
- urgency_reasoning: string (1-2 sentences)
- can_be_done_during_turnover: boolean"""

        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        try:
            text = response.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            result = json.loads(text)
        except (json.JSONDecodeError, IndexError):
            result = {"priority": "medium", "guest_impact_level": "medium", "blocks_check_in": False, "estimated_repair_hours": 2, "recommended_trade_type": input.trade_type or "general", "urgency_reasoning": "Could not classify automatically", "can_be_done_during_turnover": False}
        return {"classification": result, "classified_by": "gpt-5.2"}
    except Exception as e:
        logger.error(f"AI severity classification error: {e}")
        raise HTTPException(status_code=500, detail=f"AI classification failed: {str(e)}")

@router.post("/risk-score")
async def calculate_risk_score(input: RiskScoreRequest, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    from bson import ObjectId
    # Gather property data
    prop = await db.properties.find_one({"_id": ObjectId(input.property_id)})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    outstanding = ["new", "not_started", "assigned", "in_progress", "awaiting_approval", "awaiting_parts", "scheduled", "blocked", "reopened"]
    issues = await db.issues.find({"property_id": input.property_id, "status": {"$in": outstanding}}).to_list(50)
    turnovers = await db.turnovers.find({"property_id": input.property_id, "status": {"$nin": ["completed"]}}).to_list(10)
    try:
        chat = get_llm()
        issues_summary = [{"title": i.get("title", ""), "priority": i.get("priority", ""), "status": i.get("status", ""), "blocks_check_in": i.get("blocks_check_in", False), "trade_type": i.get("trade_type", "")} for i in issues]
        turnovers_summary = [{"status": t.get("status", ""), "due_at": t.get("due_at", ""), "risk_level": t.get("risk_level", "")} for t in turnovers]

        prompt = f"""Analyze the risk level for this vacation rental property.

Property: {prop.get('name', '')} ({prop.get('bedrooms', 0)}BR/{prop.get('bathrooms', 0)}BA)
Open Issues ({len(issues)}): {json.dumps(issues_summary)}
Active Turnovers ({len(turnovers)}): {json.dumps(turnovers_summary)}

Return JSON with:
- overall_risk_score: number 0-100 (0=no risk, 100=critical)
- risk_level: "low" | "moderate" | "high" | "critical"
- blocking_factors: array of strings
- recommendations: array of strings (top 3 actions)
- guest_readiness: boolean
- estimated_resolution_hours: number"""

        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        try:
            text = response.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            result = json.loads(text)
        except (json.JSONDecodeError, IndexError):
            blocking = sum(1 for i in issues if i.get("blocks_check_in"))
            urgent = sum(1 for i in issues if i.get("priority") == "urgent")
            score = min(100, len(issues) * 10 + blocking * 25 + urgent * 15)
            result = {"overall_risk_score": score, "risk_level": "critical" if score > 75 else "high" if score > 50 else "moderate" if score > 25 else "low", "blocking_factors": [i.get("title", "") for i in issues if i.get("blocks_check_in")], "recommendations": ["Address blocking issues first", "Schedule vendor visits", "Review checklist completion"], "guest_readiness": score < 25, "estimated_resolution_hours": len(issues) * 2}
        result["property_name"] = prop.get("name", "")
        result["open_issues_count"] = len(issues)
        result["active_turnovers_count"] = len(turnovers)
        return result
    except Exception as e:
        logger.error(f"AI risk score error: {e}")
        raise HTTPException(status_code=500, detail=f"AI risk scoring failed: {str(e)}")

@router.post("/predictive-readiness")
async def predictive_readiness(input: PredictiveReadinessRequest, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    outstanding = ["new", "not_started", "assigned", "in_progress", "awaiting_approval", "awaiting_parts", "scheduled", "blocked", "reopened"]
    query = {"status": "active"} if not input.property_id else {"_id": __import__("bson").ObjectId(input.property_id)}
    properties = await db.properties.find(query).to_list(50)
    results = []
    for prop in properties:
        pid = str(prop["_id"])
        issues = await db.issues.find({"property_id": pid, "status": {"$in": outstanding}}).to_list(50)
        turnovers = await db.turnovers.find({"property_id": pid, "status": {"$nin": ["completed"]}}).sort("due_at", 1).to_list(5)
        # Calculate predictive metrics
        blocking = sum(1 for i in issues if i.get("blocks_check_in"))
        urgent = sum(1 for i in issues if i.get("priority") == "urgent")
        high = sum(1 for i in issues if i.get("priority") == "high")
        reopened = sum(1 for i in issues if i.get("reopened_count", 0) > 0)
        unassigned = sum(1 for i in issues if not i.get("assigned_provider_id"))
        # Score: 100 = perfect, 0 = critical risk
        score = 100
        score -= blocking * 20
        score -= urgent * 12
        score -= high * 6
        score -= reopened * 8
        score -= unassigned * 5
        score -= len(issues) * 3
        score = max(0, min(100, score))
        risk_level = "low" if score >= 80 else "moderate" if score >= 60 else "high" if score >= 30 else "critical"
        next_turnover = turnovers[0] if turnovers else None
        hours_until_next = None
        if next_turnover and next_turnover.get("due_at"):
            try:
                due = datetime.fromisoformat(next_turnover["due_at"].replace("Z", "+00:00")) if isinstance(next_turnover["due_at"], str) else next_turnover["due_at"]
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
                hours_until_next = max(0, (due - datetime.now(timezone.utc)).total_seconds() / 3600)
            except Exception:
                pass
        risk_factors = []
        if blocking > 0:
            risk_factors.append(f"{blocking} issue(s) blocking check-in")
        if urgent > 0:
            risk_factors.append(f"{urgent} urgent issue(s)")
        if unassigned > 0:
            risk_factors.append(f"{unassigned} unassigned issue(s)")
        if reopened > 0:
            risk_factors.append(f"{reopened} reopened issue(s)")
        if hours_until_next and hours_until_next < 24:
            risk_factors.append(f"Next turnover in {hours_until_next:.0f} hours")
            score = max(0, score - 10)  # Extra penalty for tight timeline
        results.append({
            "property_id": pid,
            "property_name": prop.get("name", ""),
            "readiness_score": score,
            "risk_level": risk_level,
            "open_issues": len(issues),
            "blocking_issues": blocking,
            "urgent_issues": urgent,
            "unassigned_issues": unassigned,
            "reopened_issues": reopened,
            "risk_factors": risk_factors,
            "next_turnover_hours": round(hours_until_next, 1) if hours_until_next else None,
            "recommendation": "Immediate action needed" if score < 30 else "Review open issues" if score < 60 else "Monitor" if score < 80 else "Guest-ready",
        })
    results.sort(key=lambda x: x["readiness_score"])
    return {
        "properties": results,
        "portfolio_average": round(sum(r["readiness_score"] for r in results) / max(len(results), 1)),
        "at_risk_count": sum(1 for r in results if r["risk_level"] in ["high", "critical"]),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

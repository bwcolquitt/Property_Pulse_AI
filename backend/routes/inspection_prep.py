from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
from bson import ObjectId
import os, logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/inspection-prep", tags=["inspection-prep"])

def get_db(request: Request):
    return request.app.state.db

DEFAULT_INSPECTION_ITEMS = [
    {"category": "Fire Safety", "item": "Smoke detectors installed in every bedroom", "code_ref": "NFPA 72", "check_interval": "Monthly test, replace batteries yearly"},
    {"category": "Fire Safety", "item": "Smoke detector batteries less than 1 year old", "code_ref": "NFPA 72", "check_interval": "Replace annually"},
    {"category": "Fire Safety", "item": "Smoke detectors less than 10 years old", "code_ref": "NFPA 72", "check_interval": "Replace every 10 years"},
    {"category": "Fire Safety", "item": "Carbon monoxide detectors on every floor", "code_ref": "CA Health & Safety 17926", "check_interval": "Test monthly"},
    {"category": "Fire Safety", "item": "Fire extinguisher present and not expired", "code_ref": "NFPA 10", "check_interval": "Inspect annually, replace every 6 years"},
    {"category": "Fire Safety", "item": "Fire extinguisher mounted and accessible", "code_ref": "NFPA 10", "check_interval": "Always"},
    {"category": "Fire Safety", "item": "Evacuation route posted", "code_ref": "Local ordinance", "check_interval": "Always posted"},
    {"category": "Electrical", "item": "GFCI outlets in kitchen and bathrooms", "code_ref": "NEC 210.8", "check_interval": "Test monthly"},
    {"category": "Electrical", "item": "No exposed wiring or damaged outlets", "code_ref": "NEC General", "check_interval": "Each turnover"},
    {"category": "Electrical", "item": "Electrical panel labeled and accessible", "code_ref": "NEC 408.4", "check_interval": "Always"},
    {"category": "Structural", "item": "Handrails secure on all stairs", "code_ref": "IRC R311.7", "check_interval": "Each turnover"},
    {"category": "Structural", "item": "Windows open and close properly", "code_ref": "IRC R310", "check_interval": "Semi-annually"},
    {"category": "Structural", "item": "Deck/balcony railing secure (42in min)", "code_ref": "IRC R312", "check_interval": "Annually"},
    {"category": "Pool/Spa", "item": "Pool fence/barrier with self-closing gate", "code_ref": "ISPSC", "check_interval": "Always"},
    {"category": "Pool/Spa", "item": "Pool drain covers compliant (anti-entrapment)", "code_ref": "VGB Act", "check_interval": "Annually"},
    {"category": "Pool/Spa", "item": "CPR instructions posted near pool", "code_ref": "Local ordinance", "check_interval": "Always posted"},
    {"category": "General Safety", "item": "First aid kit stocked and accessible", "code_ref": "Best practice", "check_interval": "Each turnover"},
    {"category": "General Safety", "item": "Emergency numbers posted visibly", "code_ref": "Local ordinance", "check_interval": "Always posted"},
    {"category": "General Safety", "item": "Property address visible from street", "code_ref": "Local ordinance", "check_interval": "Always"},
    {"category": "Permits", "item": "Short-term rental permit current", "code_ref": "City STR Ordinance", "check_interval": "Renew per local schedule"},
    {"category": "Permits", "item": "Business license current", "code_ref": "City Business License", "check_interval": "Renew annually"},
    {"category": "Permits", "item": "TOT/transient tax registration", "code_ref": "City Tax Code", "check_interval": "Renew annually"},
]

@router.get("/checklist/{property_id}")
async def get_inspection_checklist(property_id: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    saved = await db.inspection_checklists.find_one({"property_id": property_id})
    if saved:
        return serialize_doc(saved)
    return {"property_id": property_id, "items": DEFAULT_INSPECTION_ITEMS, "last_inspection_date": None, "status": "not_started"}

class InspectionUpdate(BaseModel):
    items: list  # [{...item, checked: bool, notes: str, last_checked: str}]
    last_inspection_date: Optional[str] = None

@router.put("/checklist/{property_id}")
async def update_inspection_checklist(property_id: str, input: InspectionUpdate, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc).isoformat()
    checked_count = sum(1 for i in input.items if i.get("checked"))
    total = len(input.items)
    await db.inspection_checklists.update_one(
        {"property_id": property_id},
        {"$set": {"property_id": property_id, "items": input.items, "last_inspection_date": input.last_inspection_date, "checked_count": checked_count, "total": total, "status": "complete" if checked_count == total else "in_progress", "updated_by": user["id"], "updated_at": now}},
        upsert=True
    )
    return {"success": True, "checked": checked_count, "total": total}

@router.post("/ai-recommendations/{property_id}")
async def ai_inspection_recommendations(property_id: str, request: Request):
    """AI reviews the inspection checklist and gives recommendations."""
    db = get_db(request)
    user = await get_current_user(request, db)
    saved = await db.inspection_checklists.find_one({"property_id": property_id})
    items = (saved or {}).get("items", DEFAULT_INSPECTION_ITEMS)
    unchecked = [i for i in items if not i.get("checked")]
    overdue = [i for i in items if i.get("last_checked") and _is_overdue(i)]
    
    recommendations = []
    for item in unchecked[:5]:
        recommendations.append({"type": "unchecked", "item": item.get("item", ""), "category": item.get("category", ""), "recommendation": f"This item has not been verified. Check and mark as inspected before the city inspection.", "code_ref": item.get("code_ref", "")})
    for item in overdue[:3]:
        recommendations.append({"type": "overdue", "item": item.get("item", ""), "category": item.get("category", ""), "recommendation": f"This item is overdue for inspection per the schedule: {item.get('check_interval', '')}", "code_ref": item.get("code_ref", "")})
    
    priority_items = [i for i in unchecked if i.get("category") == "Fire Safety"]
    if priority_items:
        recommendations.insert(0, {"type": "priority", "item": "Fire Safety Items", "category": "Fire Safety", "recommendation": f"{len(priority_items)} fire safety items need attention. These are the #1 thing city inspectors check.", "code_ref": "NFPA"})
    
    return {"recommendations": recommendations, "unchecked_count": len(unchecked), "total": len(items), "compliance_score": round((len(items) - len(unchecked)) / max(len(items), 1) * 100)}

def _is_overdue(item):
    try:
        last = datetime.fromisoformat(item["last_checked"].replace("Z", "+00:00"))
        days = (datetime.now(timezone.utc) - last).days
        interval = item.get("check_interval", "")
        if "monthly" in interval.lower(): return days > 30
        if "annually" in interval.lower() or "yearly" in interval.lower(): return days > 365
        return days > 180
    except: return False

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/company-config", tags=["company-config"])

def get_db(request: Request):
    return request.app.state.db

# ===== Pydantic Models =====

class CompanyProfile(BaseModel):
    company_name: str = ""
    tagline: str = ""
    logo_url: str = ""
    website: str = ""
    primary_color: str = "#0A4F7F"
    accent_color: str = "#DDA239"
    background_color: str = "#FAF6F0"

class ContactDirectory(BaseModel):
    main_phone: str = ""
    main_email: str = ""
    emergency_phone: str = ""
    after_hours_phone: str = ""
    after_hours_email: str = ""
    maintenance_hotline: str = ""
    office_address: str = ""
    office_hours: str = ""

class CheckInOutPolicy(BaseModel):
    default_check_in_time: str = "3:00 PM"
    default_check_out_time: str = "11:00 AM"
    early_check_in_available: bool = False
    early_check_in_fee: float = 0
    late_check_out_available: bool = False
    late_check_out_fee: float = 0
    key_exchange_method: str = "lockbox"  # lockbox, smart_lock, in_person, key_cafe
    lockbox_instructions: str = ""
    smart_lock_instructions: str = ""
    access_notes: str = ""
    check_in_instructions: str = ""
    check_out_instructions: str = ""

class HouseRules(BaseModel):
    quiet_hours_start: str = "10:00 PM"
    quiet_hours_end: str = "8:00 AM"
    parking_rules: str = ""
    pets_allowed: bool = False
    pet_fee: float = 0
    pet_rules: str = ""
    smoking_allowed: bool = False
    smoking_rules: str = ""
    max_occupancy_note: str = ""
    pool_hours: str = ""
    pool_rules: str = ""
    trash_day: str = ""
    trash_instructions: str = ""
    wifi_network: str = ""
    wifi_password: str = ""
    additional_rules: str = ""

class EmergencyProcedure(BaseModel):
    procedure_type: str  # fire, flood, power_outage, medical, security, gas_leak, lockout
    title: str = ""
    instructions: str = ""
    contact_name: str = ""
    contact_phone: str = ""

class EmergencyProcedures(BaseModel):
    procedures: List[EmergencyProcedure] = []

class CommunicationPrefs(BaseModel):
    preferred_contact_method: str = "text"  # text, call, email, app
    response_time_sla: str = "Within 1 hour during business hours"
    escalation_chain: str = ""
    guest_welcome_message: str = ""
    guest_checkout_message: str = ""
    provider_welcome_message: str = ""

class LegalPolicies(BaseModel):
    cancellation_policy: str = ""
    damage_policy: str = ""
    liability_waiver: str = ""
    terms_of_service_url: str = ""
    privacy_policy_url: str = ""

class CustomFAQ(BaseModel):
    question: str
    answer: str
    role: str = "all"  # all, admin, provider, guest
    order: int = 0

class CustomFAQList(BaseModel):
    faqs: List[CustomFAQ] = []

# ===== Helper to get/set config sections =====

async def get_config_section(db, section: str, tenant_id: str = "default"):
    doc = await db.company_config.find_one({"section": section, "tenant_id": tenant_id})
    if doc:
        result = serialize_doc(doc)
        result.pop("section", None)
        result.pop("tenant_id", None)
        return result
    return {}

async def set_config_section(db, section: str, data: dict, user_id: str, tenant_id: str = "default"):
    now = datetime.now(timezone.utc).isoformat()
    data["section"] = section
    data["tenant_id"] = tenant_id
    data["updated_by"] = user_id
    data["updated_at"] = now
    await db.company_config.update_one(
        {"section": section, "tenant_id": tenant_id},
        {"$set": data},
        upsert=True
    )

# ===== Endpoints =====

@router.get("")
async def get_all_config(request: Request):
    """Get all company configuration. Public for guides/AI context."""
    db = get_db(request)
    # Try to determine tenant from token (optional); fall back to default
    tenant_id = "default"
    try:
        user = await get_current_user(request, db)
        tenant_id = user.get("tenant_id", "default")
    except Exception:
        pass
    sections = ["profile", "contacts", "check_in_out", "house_rules",
                 "emergency_procedures", "communication", "legal", "custom_faqs"]
    config = {}
    for s in sections:
        config[s] = await get_config_section(db, s, tenant_id)
    return config

@router.get("/{section}")
async def get_config(section: str, request: Request):
    db = get_db(request)
    tenant_id = "default"
    try:
        user = await get_current_user(request, db)
        tenant_id = user.get("tenant_id", "default")
    except Exception:
        pass
    return await get_config_section(db, section, tenant_id)

# ----- Company Profile -----
@router.put("/profile")
async def update_profile(input: CompanyProfile, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") not in ["property_manager", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    await set_config_section(db, "profile", input.dict(), user["id"], user.get("tenant_id", "default"))
    return {"success": True}

# ----- Contact Directory -----
@router.put("/contacts")
async def update_contacts(input: ContactDirectory, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") not in ["property_manager", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    await set_config_section(db, "contacts", input.dict(), user["id"], user.get("tenant_id", "default"))
    return {"success": True}

# ----- Check-in/Check-out -----
@router.put("/check-in-out")
async def update_check_in_out(input: CheckInOutPolicy, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") not in ["property_manager", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    await set_config_section(db, "check_in_out", input.dict(), user["id"], user.get("tenant_id", "default"))
    return {"success": True}

# ----- House Rules -----
@router.put("/house-rules")
async def update_house_rules(input: HouseRules, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") not in ["property_manager", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    await set_config_section(db, "house_rules", input.dict(), user["id"], user.get("tenant_id", "default"))
    return {"success": True}

# ----- Emergency Procedures -----
@router.put("/emergency-procedures")
async def update_emergency_procedures(input: EmergencyProcedures, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") not in ["property_manager", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    await set_config_section(db, "emergency_procedures", {"procedures": [p.dict() for p in input.procedures]}, user["id"])
    return {"success": True}

# ----- Communication Preferences -----
@router.put("/communication")
async def update_communication(input: CommunicationPrefs, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") not in ["property_manager", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    await set_config_section(db, "communication", input.dict(), user["id"], user.get("tenant_id", "default"))
    return {"success": True}

# ----- Legal / Policies -----
@router.put("/legal")
async def update_legal(input: LegalPolicies, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") not in ["property_manager", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    await set_config_section(db, "legal", input.dict(), user["id"], user.get("tenant_id", "default"))
    return {"success": True}

# ----- Custom FAQs -----
@router.put("/custom-faqs")
async def update_custom_faqs(input: CustomFAQList, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") not in ["property_manager", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    await set_config_section(db, "custom_faqs", {"faqs": [f.dict() for f in input.faqs]}, user["id"])
    return {"success": True}

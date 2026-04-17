from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import serialize_doc
from datetime import datetime, timezone
from bson import ObjectId
import os, uuid, logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai-chat", tags=["ai-chat"])

def get_db(request: Request):
    return request.app.state.db

SYSTEM_PROMPT = """You are the Property Pulse AI Assistant — a friendly, helpful guide for the Property Pulse AI platform.

You help THREE types of users:
1. **Admins / Property Managers** — They manage properties, turnovers, cleaners, maintenance, payments, and reports.
2. **Service Providers** — Cleaners and maintenance workers who complete checklists, report issues, and bid on jobs.
3. **Guests** — People booking short-term rentals directly.

IMPORTANT RULES:
- Speak at a 5th grade reading level. Use simple, clear language.
- Give step-by-step instructions with numbered steps.
- Be warm, encouraging, and patient.
- If you don't know something specific to their company, say "Please contact your property manager for company-specific details."
- Always suggest the right screen/feature in the app.

Here is what Property Pulse AI can do:

**For Admins:**
- Dashboard: See all turnovers, maintenance issues, and readiness scores at a glance
- Properties: Add/edit rental properties with photos, floor counts, nicknames
- Turnovers: Create turnover tasks when guests check out. Assign cleaners and maintenance workers
- Checklists: Floor-based checklists with mandatory photos. Drag-and-drop to reorder tasks
- Maintenance: Track all open issues. AI generates cost estimates. Admin review queue for approvals
- Inventory: Track supplies with QR codes. Set reorder points with vendor links (Amazon, etc.)
- Job Board: Post jobs for cleaners/maintenance. Review bids. Accept the best offer
- Payments: Set up Stripe for auto-payments. When a job is done, the provider gets paid automatically
- Reports: 7 report types (Outstanding Maintenance, Guest Readiness, Cleaner Scorecard, Vendor Performance, Issue Trends, Financial Summary, Turnover Completion). Export as CSV
- Reservations: Sync from Airbnb, Vrbo, Booking.com or add manual bookings
- AI Command Center: AI auto-scheduling, issue pattern detection, predictive inventory
- Recurring Schedules: Set up repeating cleaning/maintenance schedules
- Provider Calendar: See which providers are available on which days
- Assets: Track property assets (appliances, furniture) with warranties and conditions
- Supply Requests: Approve or reject supply requests from your team
- Team: Manage users and roles
- Settings: Service rates, company info

**For Service Providers (Cleaners/Maintenance):**
- Dashboard: See your assigned turnovers and tasks
- Checklists: Complete floor-based checklists. Take required photos. Report issues with the camera
- Issues: Report maintenance problems with photos and descriptions. AI estimates repair costs
- Job Board: Browse available jobs. Submit bids with your price and availability
- Geofencing: Must be near the property to mark tasks complete
- Inventory: Scan QR codes to look up supplies. Add/remove stock

**For Guests:**
- Book a Stay: Select a property, choose dates, enter your info, and submit a booking request
- The property manager will confirm your booking

**Company/Host Info:**
- For company-specific questions (who to contact, emergency procedures, specific property rules), tell users to check with their property manager or the Settings page in the app.
- For emergencies, always recommend calling 911 first, then contacting the property manager.

When answering:
1. Identify what the user needs
2. Tell them which screen to go to
3. Give clear numbered steps
4. Offer to help with anything else
"""

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_role: Optional[str] = None  # admin, cleaner, maintenance, guest

@router.post("/send")
async def send_chat_message(input: ChatMessage, request: Request):
    db = get_db(request)
    session_id = input.session_id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Save user message
    await db.ai_chat_history.insert_one({
        "session_id": session_id,
        "role": "user",
        "content": input.message,
        "user_role": input.user_role,
        "created_at": now,
    })
    
    # Get recent history for context
    history = await db.ai_chat_history.find({"session_id": session_id}).sort("created_at", 1).to_list(20)
    
    # Fetch company config for context injection
    company_context = ""
    try:
        sections = ["profile", "contacts", "check_in_out", "house_rules", "emergency_procedures", "communication", "legal", "custom_faqs"]
        for s in sections:
            doc = await db.company_config.find_one({"section": s})
            if doc:
                doc.pop("_id", None)
                doc.pop("section", None)
                doc.pop("updated_by", None)
                doc.pop("updated_at", None)
                if any(v for k, v in doc.items() if v and k not in ("id",)):
                    company_context += f"\n\n{s.upper().replace('_', ' ')} CONFIG:\n"
                    for k, v in doc.items():
                        if v and k not in ("id",):
                            company_context += f"- {k}: {v}\n"
    except Exception as e:
        logger.warning(f"Could not fetch company config for AI: {e}")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        from dotenv import load_dotenv
        load_dotenv()
        
        api_key = os.environ.get("EMERGENT_LLM_KEY", "")
        if not api_key:
            raise Exception("No LLM key configured")
        
        role_context = ""
        if input.user_role:
            role_context = f"\n\nThe user's role is: {input.user_role}. Tailor your answers to their role."
        
        dynamic_context = ""
        if company_context:
            dynamic_context = f"\n\n=== THIS COMPANY'S SPECIFIC INFORMATION ===\nUse this real data when answering questions about the company, contacts, policies, rules, and procedures:{company_context}\n=== END COMPANY INFO ==="
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"pp-{session_id}",
            system_message=SYSTEM_PROMPT + role_context + dynamic_context
        )
        chat.with_model("openai", "gpt-5.2")
        
        # Build conversation context
        context_msgs = []
        for h in history[:-1]:  # Exclude the message we just saved
            if h["role"] == "user":
                context_msgs.append(f"User: {h['content']}")
            else:
                context_msgs.append(f"Assistant: {h['content']}")
        
        full_message = ""
        if context_msgs:
            full_message = "Previous conversation:\n" + "\n".join(context_msgs[-10:]) + "\n\nNew message: "
        full_message += input.message
        
        user_msg = UserMessage(text=full_message)
        response = await chat.send_message(user_msg)
        
        # Save assistant response
        await db.ai_chat_history.insert_one({
            "session_id": session_id,
            "role": "assistant",
            "content": response,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        return {"response": response, "session_id": session_id}
        
    except Exception as e:
        logger.error(f"AI Chat error: {e}")
        fallback = "I'm sorry, I'm having trouble right now. Here are some quick tips:\n\n"
        fallback += "1. **For turnovers** — Go to the Dashboard tab\n"
        fallback += "2. **For checklists** — Tap on a turnover, then tap the checklist\n"
        fallback += "3. **For maintenance** — Use the Issues tab or report from a checklist\n"
        fallback += "4. **For inventory** — Go to More > Inventory\n"
        fallback += "5. **For payments** — Go to More > Payments\n"
        fallback += "\nPlease try again in a moment!"
        
        await db.ai_chat_history.insert_one({
            "session_id": session_id,
            "role": "assistant",
            "content": fallback,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"response": fallback, "session_id": session_id}

@router.get("/history/{session_id}")
async def get_chat_history(session_id: str, request: Request):
    db = get_db(request)
    history = await db.ai_chat_history.find({"session_id": session_id}).sort("created_at", 1).to_list(50)
    return [serialize_doc(h) for h in history]

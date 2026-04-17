from fastapi import APIRouter, Request
from helpers import get_current_user, serialize_doc

router = APIRouter(prefix="/api/guides", tags=["guides"])

def get_db(request: Request):
    return request.app.state.db

async def get_company_config(db):
    """Fetch all company config sections for injection into guides."""
    sections = ["profile", "contacts", "check_in_out", "house_rules",
                 "emergency_procedures", "communication", "legal", "custom_faqs"]
    config = {}
    for s in sections:
        doc = await db.company_config.find_one({"section": s})
        if doc:
            d = serialize_doc(doc)
            d.pop("section", None)
            config[s] = d
        else:
            config[s] = {}
    return config

def inject_company_vars(guides: list, config: dict) -> list:
    """Replace {{variable}} placeholders with company config values and append dynamic sections."""
    profile = config.get("profile", {})
    contacts = config.get("contacts", {})
    check_in = config.get("check_in_out", {})
    rules = config.get("house_rules", {})
    comm = config.get("communication", {})
    legal = config.get("legal", {})
    
    company_name = profile.get("company_name", "your property manager")
    
    var_map = {
        "{{company_name}}": company_name,
        "{{main_phone}}": contacts.get("main_phone", "the main office"),
        "{{main_email}}": contacts.get("main_email", "the office email"),
        "{{emergency_phone}}": contacts.get("emergency_phone", "911"),
        "{{after_hours_phone}}": contacts.get("after_hours_phone", "the after-hours line"),
        "{{maintenance_hotline}}": contacts.get("maintenance_hotline", "the maintenance line"),
        "{{office_hours}}": contacts.get("office_hours", "business hours"),
        "{{check_in_time}}": check_in.get("default_check_in_time", "3:00 PM"),
        "{{check_out_time}}": check_in.get("default_check_out_time", "11:00 AM"),
        "{{key_method}}": check_in.get("key_exchange_method", "lockbox"),
        "{{quiet_hours}}": f"{rules.get('quiet_hours_start', '10 PM')} to {rules.get('quiet_hours_end', '8 AM')}",
        "{{wifi_network}}": rules.get("wifi_network", "ask your host"),
        "{{wifi_password}}": rules.get("wifi_password", "ask your host"),
        "{{preferred_contact}}": comm.get("preferred_contact_method", "text"),
        "{{response_sla}}": comm.get("response_time_sla", "as soon as possible"),
        "{{cancellation_policy}}": legal.get("cancellation_policy", "Contact your property manager for details"),
    }
    
    result = []
    for guide in guides:
        g = dict(guide)
        # Replace vars in steps
        if "steps" in g:
            g["steps"] = [_replace_vars(s, var_map) for s in g["steps"]]
        if "tips" in g:
            g["tips"] = [_replace_vars(t, var_map) for t in g["tips"]]
        if "summary" in g:
            g["summary"] = _replace_vars(g["summary"], var_map)
        result.append(g)
    return result

def _replace_vars(text: str, var_map: dict) -> str:
    for key, val in var_map.items():
        text = text.replace(key, val)
    return text

ADMIN_GUIDES = [
    {
        "id": "getting-started",
        "title": "Getting Started",
        "icon": "rocket",
        "color": "#0A4F7F",
        "summary": "Set up your account and add your first property",
        "steps": [
            "Log in with your admin email and password",
            "Go to the Dashboard — this is your home base",
            "Tap 'More' tab at the bottom, then 'Properties'",
            "Tap the + button to add a new property",
            "Enter the address, nickname, bedrooms, bathrooms, and floors",
            "Upload a cover photo so everyone can recognize it",
            "Hit Save — your property is ready!"
        ],
        "tips": ["Give each property a fun nickname like 'Oceanview' or 'Sunset Cove' so your team can find it fast"]
    },
    {
        "id": "turnovers",
        "title": "Managing Turnovers",
        "icon": "refresh-circle",
        "color": "#2196F3",
        "summary": "Create and assign turnovers when guests check out",
        "steps": [
            "Go to the Dashboard or Turnovers tab",
            "Tap '+ New Turnover' button",
            "Pick the property and set the due date",
            "Assign a cleaner from your team",
            "The cleaner will see it on their dashboard right away",
            "Track progress — the percentage bar shows how much is done",
            "When it hits 100%, the property is guest-ready!"
        ],
        "tips": ["Create turnovers as soon as a guest checks out so your team can start right away"]
    },
    {
        "id": "checklists",
        "title": "Checklists & Photos",
        "icon": "checkbox",
        "color": "#4CAF50",
        "summary": "Set up floor-based checklists with photo requirements",
        "steps": [
            "Each turnover has a checklist organized by floor",
            "Tasks are color-coded: blue for cleaning, gold for maintenance",
            "Some tasks need photos — look for the red camera icon",
            "Cleaners tap each task to mark it done",
            "They take photos as proof the work is complete",
            "You can reorder tasks by tapping the reorder button and dragging",
            "Report issues directly from the checklist with photos"
        ],
        "tips": ["Require photos for important tasks like bathrooms, kitchens, and pool areas"]
    },
    {
        "id": "payments",
        "title": "Auto-Payments",
        "icon": "card",
        "color": "#DDA239",
        "summary": "Set up Stripe so providers get paid automatically",
        "steps": [
            "Go to More > Payments",
            "Tap 'Stripe Setup' tab",
            "Enter your Stripe publishable key and secret key from dashboard.stripe.com",
            "Turn on 'Auto-Pay Enabled' and 'Pay on Job Complete'",
            "Tap 'Save Configuration'",
            "Go to 'Providers' tab and set up each provider's Stripe Connect account",
            "When a job is marked complete, payment happens automatically!"
        ],
        "tips": ["No more invoices! Providers get paid as soon as the job is done"]
    },
    {
        "id": "inventory",
        "title": "Inventory & QR Codes",
        "icon": "cube",
        "color": "#9C27B0",
        "summary": "Track supplies with QR codes and auto-reorder",
        "steps": [
            "Go to More > Inventory",
            "Each item shows: quantity on hand, par level, and reorder level",
            "When stock is low, you'll see a red 'Low' badge",
            "Tap 'QR' on any item to print a fold-and-hang label",
            "Put the QR label on the storage box",
            "When stock is low, tap 'Reorder from Vendor' to go to Amazon or your vendor",
            "Scan QR codes with your phone camera to look up items instantly"
        ],
        "tips": ["Set up Amazon links for each item so reordering is just one tap"]
    },
    {
        "id": "reports",
        "title": "Reports & Analytics",
        "icon": "bar-chart",
        "color": "#FF5722",
        "summary": "View reports on maintenance, readiness, and finances",
        "steps": [
            "Go to More > Reports",
            "Tap any report card to expand and see the data",
            "7 report types: Outstanding Maintenance, Guest Readiness, Turnover Completion, Cleaner Scorecard, Vendor Performance, Issue Trends, Financial Summary",
            "Tap the 'CSV' button on any report to download it",
            "Use reports to find your best cleaners, most problematic properties, and biggest costs"
        ],
        "tips": ["Check the Outstanding Maintenance report daily to make sure nothing is missed"]
    },
    {
        "id": "reservations",
        "title": "Reservations & Bookings",
        "icon": "bed",
        "color": "#FF5A5F",
        "summary": "Sync reservations from Airbnb, Vrbo, and direct guests",
        "steps": [
            "Go to More > Reservations",
            "Tap 'Sync' to pull reservations from Airbnb, Vrbo, or Booking.com",
            "Tap 'Add Manual' for phone or email bookings",
            "Guest direct bookings show up automatically with 'Pending' status",
            "Review and confirm pending bookings",
            "Each reservation shows check-in, check-out dates and guest count"
        ],
        "tips": ["Share the guest booking link so guests can book directly — no middleman fees!"]
    },
    {
        "id": "job-board",
        "title": "Job Board & Bidding",
        "icon": "briefcase",
        "color": "#607D8B",
        "summary": "Post jobs and get bids from service providers",
        "steps": [
            "Go to More > Job Board",
            "Tap the + button to post a new job",
            "Pick the property, type (cleaning, maintenance, pool, deep clean)",
            "Set urgency and budget range",
            "Service providers will see the job and submit bids",
            "Review bids — see each provider's price and message",
            "Accept the best bid — the other providers are notified automatically"
        ],
        "tips": ["Include detailed descriptions so providers give you accurate bids"]
    }
]

PROVIDER_GUIDES = [
    {
        "id": "provider-start",
        "title": "Getting Started",
        "icon": "person",
        "color": "#0A4F7F",
        "summary": "Log in and find your assigned work",
        "steps": [
            "Your property manager will create your account",
            "Log in with the email and password they gave you",
            "The Dashboard shows your assigned turnovers and tasks",
            "Tap on a turnover to see the property and checklist",
            "Complete tasks one by one — the progress bar updates as you go"
        ],
        "tips": ["Check your dashboard every morning for new assignments"]
    },
    {
        "id": "completing-checklists",
        "title": "Completing Checklists",
        "icon": "checkbox",
        "color": "#4CAF50",
        "summary": "Work through your checklist floor by floor",
        "steps": [
            "Open the turnover, then tap the checklist",
            "Tasks are organized by floor — start from the top",
            "Tap a task to mark it done (green checkmark appears)",
            "If a task has a red camera icon, you MUST take a photo first",
            "Tap the camera button to take a photo, or the gallery button to pick one",
            "To report a problem, tap the warning icon on any floor header",
            "Describe the issue, take a photo, and submit"
        ],
        "tips": ["Take clear, well-lit photos. They're your proof that the job was done right!"]
    },
    {
        "id": "reporting-issues",
        "title": "Reporting Issues",
        "icon": "warning",
        "color": "#F44336",
        "summary": "Found something broken? Report it right away",
        "steps": [
            "On the checklist, tap the red warning icon on any floor",
            "Enter a title like 'Broken faucet in master bath'",
            "Add details about what you see",
            "Take a photo showing the problem",
            "Select the priority: normal, high, or urgent",
            "Tap 'Submit Issue' — the manager gets notified right away",
            "AI will estimate the repair cost automatically"
        ],
        "tips": ["Always report issues, even small ones. It's better to catch them early!"]
    },
    {
        "id": "bidding-jobs",
        "title": "Bidding on Jobs",
        "icon": "cash",
        "color": "#DDA239",
        "summary": "Find work and submit bids",
        "steps": [
            "Go to More > Job Board",
            "Browse open jobs — they show the property, type, and budget",
            "Tap a job to see all the details",
            "Scroll down to 'Submit a Bid'",
            "Enter your price and estimated hours",
            "Add a message about why you're the best fit",
            "If your bid is accepted, you'll be assigned the job",
            "Complete the work and get paid automatically!"
        ],
        "tips": ["Respond fast! The first good bid usually wins"]
    },
    {
        "id": "reference-media",
        "title": "Reference Photos & Videos",
        "icon": "images",
        "color": "#2196F3",
        "summary": "Use reference media to do the job right",
        "steps": [
            "Some tasks have a blue 'Ref Photo' or 'Ref Video' badge",
            "These show you exactly how things should look when done",
            "Look at the reference before you start the task",
            "Match your work to the reference photo",
            "You can also attach your own reference photos using the clip button",
            "This helps the next person know what to do"
        ],
        "tips": ["Reference photos are your best friend — they show you exactly what 'done right' looks like"]
    }
]

GUEST_GUIDES = [
    {
        "id": "booking",
        "title": "Booking a Stay",
        "icon": "calendar",
        "color": "#0A4F7F",
        "summary": "How to book a rental property",
        "steps": [
            "Go to the Property Pulse AI website",
            "Tap 'Book a Stay as Guest'",
            "Browse the available properties — you'll see photos, beds, and baths",
            "Tap on a property to select it",
            "Enter your name and email address",
            "Pick your check-in and check-out dates",
            "Choose how many adults, children, and infants",
            "Add any special requests (early check-in, late checkout, etc.)",
            "Tap 'Request Booking'",
            "You'll get a confirmation once the property manager approves!"
        ],
        "tips": ["Book early for the best dates! Popular properties fill up fast"]
    },
    {
        "id": "during-stay",
        "title": "During Your Stay",
        "icon": "home",
        "color": "#4CAF50",
        "summary": "What to do during your visit",
        "steps": [
            "Check in at the time listed in your confirmation",
            "Follow any house rules provided by the property manager",
            "If something is broken or not working, contact the property manager right away",
            "For emergencies (fire, flood, medical), call 911 first",
            "Enjoy your stay!",
            "Check out on time and leave the property as you found it"
        ],
        "tips": ["Take photos when you arrive so there are no surprises at checkout"]
    },
    {
        "id": "contact",
        "title": "Who to Contact",
        "icon": "call",
        "color": "#FF5722",
        "summary": "Need help? Here's who to reach out to",
        "steps": [
            "For booking questions — contact the property manager listed in your confirmation email",
            "For property issues during your stay — text or call the property manager",
            "For emergencies — always call 911 first",
            "For billing questions — contact the property manager",
            "For app questions — use the AI Chat for instant answers"
        ],
        "tips": ["Save the property manager's phone number before your trip"]
    }
]

@router.get("")
async def get_all_guides(request: Request):
    db = get_db(request)
    config = await get_company_config(db)
    
    contacts = config.get("contacts", {})
    emergency = config.get("emergency_procedures", {})
    check_in = config.get("check_in_out", {})
    rules = config.get("house_rules", {})
    custom_faqs = config.get("custom_faqs", {}).get("faqs", [])
    company_name = config.get("profile", {}).get("company_name", "")
    
    dynamic_guest = list(GUEST_GUIDES)
    
    # Replace contact guide with real company data
    if contacts.get("main_phone") or contacts.get("emergency_phone"):
        dynamic_guest[2] = {
            "id": "contact", "title": "Who to Contact", "icon": "call", "color": "#FF5722",
            "summary": f"Need help? Here's who to reach at {company_name or 'your property manager'}",
            "steps": [
                f"For booking questions — call {contacts.get('main_phone', 'the office')} or email {contacts.get('main_email', 'the office')}",
                f"Office hours: {contacts.get('office_hours', 'Check with your host')}",
                f"After hours: {contacts.get('after_hours_phone', 'Leave a message')}",
                f"Maintenance emergencies: {contacts.get('maintenance_hotline', 'Call the main office')}",
                "For life-threatening emergencies — always call 911 first",
                "For app questions — use the AI Chat for instant answers",
            ],
            "tips": ["Save the emergency number in your phone before your trip!"]
        }
    
    # Add check-in guide
    if check_in.get("check_in_instructions") or check_in.get("key_exchange_method"):
        dynamic_guest.insert(1, {
            "id": "check-in-details", "title": "Check-in Instructions", "icon": "key", "color": "#2196F3",
            "summary": "Everything you need to get into your rental",
            "steps": [
                f"Check-in time: {check_in.get('default_check_in_time', '3:00 PM')}",
                f"Check-out time: {check_in.get('default_check_out_time', '11:00 AM')}",
                f"Key access: {check_in.get('key_exchange_method', 'Contact your host')}",
                check_in.get("lockbox_instructions") or check_in.get("smart_lock_instructions") or check_in.get("check_in_instructions") or "Your host will send instructions before arrival",
                check_in.get("check_out_instructions") or "Leave the property clean and lock all doors",
            ],
            "tips": ["Arrive during daylight if possible"]
        })
    
    # Add house rules guide
    if rules.get("parking_rules") or rules.get("pool_rules") or rules.get("additional_rules") or rules.get("wifi_network"):
        rule_steps = [s for s in [
            f"Quiet hours: {rules.get('quiet_hours_start', '10 PM')} to {rules.get('quiet_hours_end', '8 AM')}",
            f"Parking: {rules.get('parking_rules')}" if rules.get("parking_rules") else None,
            f"Pets: {'Allowed' if rules.get('pets_allowed') else 'Not allowed'}" + (f" — {rules.get('pet_rules')}" if rules.get('pet_rules') else ""),
            "No smoking on property" if not rules.get("smoking_allowed") else f"Smoking: {rules.get('smoking_rules', 'designated areas only')}",
            f"Pool: {rules.get('pool_hours', '')} {rules.get('pool_rules', '')}" if rules.get("pool_hours") or rules.get("pool_rules") else None,
            f"Trash: {rules.get('trash_instructions')}" if rules.get("trash_instructions") else None,
            f"WiFi: {rules.get('wifi_network', '')} / Password: {rules.get('wifi_password', '')}" if rules.get("wifi_network") else None,
            rules.get("additional_rules") if rules.get("additional_rules") else None,
        ] if s is not None]
        dynamic_guest.insert(2, {
            "id": "house-rules", "title": "House Rules", "icon": "document-text", "color": "#9C27B0",
            "summary": "Please follow these rules during your stay",
            "steps": rule_steps, "tips": ["Following the house rules helps keep the property nice for everyone!"]
        })
    
    # Add emergency procedures
    procedures = emergency.get("procedures", [])
    if procedures:
        steps = ["For ANY life-threatening emergency, call 911 first!"]
        for proc in procedures:
            steps.append(f"{proc.get('title', proc.get('procedure_type', ''))}: {proc.get('instructions', '')} — Call: {proc.get('contact_phone', '')}")
        dynamic_guest.append({
            "id": "emergencies", "title": "Emergency Procedures", "icon": "medkit", "color": "#F44336",
            "summary": "What to do in an emergency",
            "steps": steps, "tips": ["Keep calm and follow the steps!"]
        })
    
    admin_guides = inject_company_vars(list(ADMIN_GUIDES), config)
    provider_guides = inject_company_vars(list(PROVIDER_GUIDES), config)
    guest_guides = inject_company_vars(dynamic_guest, config)
    
    for faq in custom_faqs:
        faq_guide = {"id": f"faq-{custom_faqs.index(faq)}", "title": faq.get("question", ""), "icon": "help-circle", "color": "#607D8B", "summary": "Custom FAQ", "steps": [faq.get("answer", "")], "tips": []}
        role = faq.get("role", "all")
        if role in ("all", "admin"): admin_guides.append(faq_guide)
        if role in ("all", "provider"): provider_guides.append(faq_guide)
        if role in ("all", "guest"): guest_guides.append(faq_guide)
    
    return {"admin": admin_guides, "provider": provider_guides, "guest": guest_guides, "company": config.get("profile", {})}

from fastapi import APIRouter, Request
from helpers import get_current_user

router = APIRouter(prefix="/api/guides", tags=["guides"])

def get_db(request: Request):
    return request.app.state.db

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
    return {
        "admin": ADMIN_GUIDES,
        "provider": PROVIDER_GUIDES,
        "guest": GUEST_GUIDES,
    }

@router.get("/{role}")
async def get_role_guides(role: str, request: Request):
    if role == "admin":
        return ADMIN_GUIDES
    elif role == "provider":
        return PROVIDER_GUIDES
    elif role == "guest":
        return GUEST_GUIDES
    return []

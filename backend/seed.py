from datetime import datetime, timezone, timedelta
from helpers import hash_password
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

async def seed_database(db):
    """Seed database with rich demo data for the rental turnover platform"""
    # Check if already seeded
    existing_users = await db.users.count_documents({})
    if existing_users > 0:
        logger.info("Database already seeded, skipping")
        # Still ensure admin exists
        import os
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
        admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
        admin = await db.users.find_one({"email": admin_email})
        if not admin:
            await db.users.insert_one({
                "email": admin_email,
                "password_hash": hash_password(admin_password),
                "first_name": "Admin",
                "last_name": "Manager",
                "role": "super_admin",
                "phone": "+1-555-0100",
                "company_name": "Coastal Rentals",
                "status": "active",
                "language": "en",
                "avatar_url": "",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            })
        return

    logger.info("Seeding database with demo data...")
    now = datetime.now(timezone.utc)

    # ========== USERS ==========
    import os
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")

    admin_id = ObjectId()
    cleaner_id = ObjectId()
    vendor_id = ObjectId()
    inspector_id = ObjectId()
    cleaner2_id = ObjectId()

    users = [
        {
            "_id": admin_id,
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "first_name": "Alex",
            "last_name": "Rivera",
            "role": "property_manager",
            "phone": "+1-555-0100",
            "company_name": "Coastal Rentals",
            "status": "active",
            "language": "en",
            "avatar_url": "",
            "created_at": now,
            "updated_at": now,
        },
        {
            "_id": cleaner_id,
            "email": "maria@example.com",
            "password_hash": hash_password("cleaner123"),
            "first_name": "Maria",
            "last_name": "Santos",
            "role": "cleaner",
            "phone": "+1-555-0201",
            "company_name": "",
            "status": "active",
            "language": "en",
            "avatar_url": "",
            "created_at": now,
            "updated_at": now,
        },
        {
            "_id": vendor_id,
            "email": "bob@fixitpro.com",
            "password_hash": hash_password("vendor123"),
            "first_name": "Bob",
            "last_name": "Thompson",
            "role": "maintenance_technician",
            "phone": "+1-555-0301",
            "company_name": "Fix-It Pro Services",
            "status": "active",
            "language": "en",
            "avatar_url": "",
            "created_at": now,
            "updated_at": now,
        },
        {
            "_id": inspector_id,
            "email": "sarah@example.com",
            "password_hash": hash_password("inspector123"),
            "first_name": "Sarah",
            "last_name": "Johnson",
            "role": "inspector",
            "phone": "+1-555-0401",
            "company_name": "",
            "status": "active",
            "language": "en",
            "avatar_url": "",
            "created_at": now,
            "updated_at": now,
        },
        {
            "_id": cleaner2_id,
            "email": "carlos@example.com",
            "password_hash": hash_password("cleaner123"),
            "first_name": "Carlos",
            "last_name": "Garcia",
            "role": "cleaner",
            "phone": "+1-555-0501",
            "company_name": "Sparkle Clean Co.",
            "status": "active",
            "language": "es",
            "avatar_url": "",
            "created_at": now,
            "updated_at": now,
        },
    ]
    await db.users.insert_many(users)

    # ========== PROPERTIES ==========
    prop1_id = ObjectId()
    prop2_id = ObjectId()
    prop3_id = ObjectId()
    prop4_id = ObjectId()

    properties = [
        {
            "_id": prop1_id,
            "name": "Oceanview Beach House",
            "code": "OBH-101",
            "address_1": "123 Shoreline Drive",
            "city": "Malibu",
            "state": "CA",
            "postal_code": "90265",
            "country": "US",
            "latitude": 34.0259,
            "longitude": -118.7798,
            "property_type": "beach_house",
            "bedrooms": 3,
            "bathrooms": 2,
            "sleeps": 8,
            "square_feet": 2200,
            "status": "active",
            "cover_photo_url": "https://images.unsplash.com/photo-1766430956209-72d1c28a16ec?w=800",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        },
        {
            "_id": prop2_id,
            "name": "Sunset Cove Cottage",
            "code": "SCC-202",
            "address_1": "456 Palm Beach Blvd",
            "city": "Santa Monica",
            "state": "CA",
            "postal_code": "90401",
            "country": "US",
            "latitude": 34.0195,
            "longitude": -118.4912,
            "property_type": "cottage",
            "bedrooms": 2,
            "bathrooms": 1,
            "sleeps": 4,
            "square_feet": 1100,
            "status": "active",
            "cover_photo_url": "https://images.unsplash.com/photo-1771218830322-9a29f883025a?w=800",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        },
        {
            "_id": prop3_id,
            "name": "Harbor View Penthouse",
            "code": "HVP-303",
            "address_1": "789 Marina Way, Unit PH1",
            "city": "Newport Beach",
            "state": "CA",
            "postal_code": "92661",
            "country": "US",
            "latitude": 33.6189,
            "longitude": -117.9298,
            "property_type": "penthouse",
            "bedrooms": 4,
            "bathrooms": 3,
            "sleeps": 10,
            "square_feet": 3500,
            "status": "active",
            "cover_photo_url": "https://images.unsplash.com/photo-1766430956209-72d1c28a16ec?w=800",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        },
        {
            "_id": prop4_id,
            "name": "Dune Breeze Studio",
            "code": "DBS-404",
            "address_1": "321 Sandcastle Lane",
            "city": "Laguna Beach",
            "state": "CA",
            "postal_code": "92651",
            "country": "US",
            "latitude": 33.5427,
            "longitude": -117.7854,
            "property_type": "studio",
            "bedrooms": 1,
            "bathrooms": 1,
            "sleeps": 2,
            "square_feet": 650,
            "status": "active",
            "cover_photo_url": "https://images.unsplash.com/photo-1771218830322-9a29f883025a?w=800",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        },
    ]
    await db.properties.insert_many(properties)

    # ========== PROPERTY ACCESS ==========
    access_docs = [
        {"property_id": str(prop1_id), "entry_method": "smart_lock", "lock_code": "1234#", "parking_notes": "2 spots in driveway", "wifi_name": "OceanView_Guest", "wifi_password": "beach2024!", "trash_notes": "Bins at side of house, pickup Tues", "special_instructions": "Leave porch light on"},
        {"property_id": str(prop2_id), "entry_method": "lockbox", "lock_code": "5678", "parking_notes": "Street parking only", "wifi_name": "SunsetCove", "wifi_password": "palm456", "trash_notes": "Community bins in parking lot", "special_instructions": "Water plants on patio"},
        {"property_id": str(prop3_id), "entry_method": "concierge", "lock_code": "N/A", "parking_notes": "Underground garage spot P2-15", "wifi_name": "HarborPH", "wifi_password": "marina789", "trash_notes": "Chute on each floor", "special_instructions": "Check pool access card is in drawer"},
        {"property_id": str(prop4_id), "entry_method": "smart_lock", "lock_code": "9012#", "parking_notes": "1 assigned spot", "wifi_name": "DuneBreeze", "wifi_password": "sand2024", "trash_notes": "Complex dumpster behind building", "special_instructions": ""},
    ]
    await db.property_access.insert_many(access_docs)

    # ========== RESERVATIONS ==========
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    res1_id = ObjectId()
    res2_id = ObjectId()
    res3_id = ObjectId()
    res4_id = ObjectId()
    res5_id = ObjectId()
    res6_id = ObjectId()

    reservations = [
        {"_id": res1_id, "property_id": str(prop1_id), "source_system": "airbnb", "external_reservation_id": "AIR-001", "guest_name": "John & Emily Watson", "check_in_at": (today + timedelta(hours=15)).isoformat(), "check_out_at": (today + timedelta(hours=11)).isoformat(), "reservation_status": "confirmed", "created_at": now.isoformat()},
        {"_id": res2_id, "property_id": str(prop2_id), "source_system": "vrbo", "external_reservation_id": "VRB-002", "guest_name": "The Martinez Family", "check_in_at": (today + timedelta(days=1, hours=16)).isoformat(), "check_out_at": (today + timedelta(hours=10)).isoformat(), "reservation_status": "confirmed", "created_at": now.isoformat()},
        {"_id": res3_id, "property_id": str(prop3_id), "source_system": "booking.com", "external_reservation_id": "BKG-003", "guest_name": "Sarah & Tom Chen", "check_in_at": (today + timedelta(days=2, hours=14)).isoformat(), "check_out_at": (today + timedelta(days=1, hours=11)).isoformat(), "reservation_status": "confirmed", "created_at": now.isoformat()},
        {"_id": res4_id, "property_id": str(prop4_id), "source_system": "airbnb", "external_reservation_id": "AIR-004", "guest_name": "Mike Johnson", "check_in_at": (today + timedelta(hours=14)).isoformat(), "check_out_at": (today - timedelta(hours=1)).isoformat(), "reservation_status": "checked_out", "created_at": now.isoformat()},
        {"_id": res5_id, "property_id": str(prop1_id), "source_system": "direct", "external_reservation_id": "DIR-005", "guest_name": "Lisa Park", "check_in_at": (today + timedelta(days=3, hours=15)).isoformat(), "check_out_at": (today + timedelta(days=1, hours=11)).isoformat(), "reservation_status": "confirmed", "created_at": now.isoformat()},
        {"_id": res6_id, "property_id": str(prop3_id), "source_system": "airbnb", "external_reservation_id": "AIR-006", "guest_name": "David & Amy Lee", "check_in_at": (today + timedelta(days=5, hours=15)).isoformat(), "check_out_at": (today + timedelta(days=3, hours=11)).isoformat(), "reservation_status": "confirmed", "created_at": now.isoformat()},
    ]
    await db.reservations.insert_many(reservations)

    # ========== TURNOVERS ==========
    t1_id = ObjectId()
    t2_id = ObjectId()
    t3_id = ObjectId()
    t4_id = ObjectId()
    t5_id = ObjectId()

    turnovers = [
        {"_id": t1_id, "property_id": str(prop1_id), "reservation_id": str(res1_id), "title": "Turnover - Oceanview Beach House", "status": "in_progress", "cleaner_assignment_type": "individual", "assigned_provider_id": str(cleaner_id), "due_at": (today + timedelta(hours=14)).isoformat(), "ready_for_inspection_at": None, "completed_at": None, "readiness_score": 65, "risk_level": "normal", "notes": "Standard turnover, 3 night stay", "created_at": now.isoformat(), "updated_at": now.isoformat()},
        {"_id": t2_id, "property_id": str(prop2_id), "reservation_id": str(res2_id), "title": "Turnover - Sunset Cove Cottage", "status": "assigned", "cleaner_assignment_type": "individual", "assigned_provider_id": str(cleaner2_id), "due_at": (today + timedelta(days=1, hours=14)).isoformat(), "ready_for_inspection_at": None, "completed_at": None, "readiness_score": 0, "risk_level": "at_risk", "notes": "Deep clean needed - pet stay", "created_at": now.isoformat(), "updated_at": now.isoformat()},
        {"_id": t3_id, "property_id": str(prop3_id), "reservation_id": str(res3_id), "title": "Turnover - Harbor View Penthouse", "status": "new", "cleaner_assignment_type": "individual", "assigned_provider_id": None, "due_at": (today + timedelta(days=2, hours=12)).isoformat(), "ready_for_inspection_at": None, "completed_at": None, "readiness_score": 0, "risk_level": "normal", "notes": "", "created_at": now.isoformat(), "updated_at": now.isoformat()},
        {"_id": t4_id, "property_id": str(prop4_id), "reservation_id": str(res4_id), "title": "Turnover - Dune Breeze Studio", "status": "ready_for_inspection", "cleaner_assignment_type": "individual", "assigned_provider_id": str(cleaner_id), "due_at": (today + timedelta(hours=13)).isoformat(), "ready_for_inspection_at": now.isoformat(), "completed_at": None, "readiness_score": 100, "risk_level": "normal", "notes": "Quick turn", "created_at": now.isoformat(), "updated_at": now.isoformat()},
        {"_id": t5_id, "property_id": str(prop1_id), "reservation_id": str(res5_id), "title": "Turnover - Oceanview (Next Guest)", "status": "new", "cleaner_assignment_type": "individual", "assigned_provider_id": None, "due_at": (today + timedelta(days=3, hours=13)).isoformat(), "ready_for_inspection_at": None, "completed_at": None, "readiness_score": 0, "risk_level": "normal", "notes": "", "created_at": now.isoformat(), "updated_at": now.isoformat()},
    ]
    await db.turnovers.insert_many(turnovers)

    # ========== CHECKLIST TEMPLATES ==========
    ct1_id = ObjectId()
    ct_items = [
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Kitchen", "title": "Clean countertops and backsplash", "description": "", "sort_order": 1, "requires_photo": True, "requires_before_after": True, "requires_note": False, "default_estimated_minutes": 10, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Kitchen", "title": "Clean and sanitize sink", "description": "", "sort_order": 2, "requires_photo": False, "requires_before_after": False, "requires_note": False, "default_estimated_minutes": 5, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Kitchen", "title": "Wipe down appliances", "description": "Fridge, microwave, oven, dishwasher", "sort_order": 3, "requires_photo": True, "requires_before_after": False, "requires_note": False, "default_estimated_minutes": 15, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Kitchen", "title": "Empty trash and replace liner", "description": "", "sort_order": 4, "requires_photo": False, "requires_before_after": False, "requires_note": False, "default_estimated_minutes": 3, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Living Room", "title": "Vacuum all carpets and rugs", "description": "", "sort_order": 5, "requires_photo": True, "requires_before_after": True, "requires_note": False, "default_estimated_minutes": 15, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Living Room", "title": "Dust all surfaces and decor", "description": "Shelves, TV, coffee table, windowsills", "sort_order": 6, "requires_photo": False, "requires_before_after": False, "requires_note": False, "default_estimated_minutes": 10, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Living Room", "title": "Fluff and arrange pillows/throws", "description": "", "sort_order": 7, "requires_photo": True, "requires_before_after": False, "requires_note": False, "default_estimated_minutes": 5, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Bedroom", "title": "Strip and remake beds with fresh linens", "description": "", "sort_order": 8, "requires_photo": True, "requires_before_after": True, "requires_note": False, "default_estimated_minutes": 20, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Bedroom", "title": "Clean mirrors and glass surfaces", "description": "", "sort_order": 9, "requires_photo": False, "requires_before_after": False, "requires_note": False, "default_estimated_minutes": 5, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Bedroom", "title": "Check drawers and closets are empty", "description": "Report any guest left-behinds", "sort_order": 10, "requires_photo": False, "requires_before_after": False, "requires_note": True, "default_estimated_minutes": 5, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Bathroom", "title": "Scrub and sanitize toilet", "description": "", "sort_order": 11, "requires_photo": False, "requires_before_after": False, "requires_note": False, "default_estimated_minutes": 10, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Bathroom", "title": "Clean shower/tub and glass doors", "description": "", "sort_order": 12, "requires_photo": True, "requires_before_after": True, "requires_note": False, "default_estimated_minutes": 15, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Bathroom", "title": "Restock toiletries and towels", "description": "Shampoo, conditioner, soap, 2 bath towels per guest", "sort_order": 13, "requires_photo": True, "requires_before_after": False, "requires_note": True, "default_estimated_minutes": 5, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Outdoor", "title": "Sweep patio/deck", "description": "", "sort_order": 14, "requires_photo": True, "requires_before_after": False, "requires_note": False, "default_estimated_minutes": 10, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Outdoor", "title": "Check BBQ grill is clean", "description": "", "sort_order": 15, "requires_photo": True, "requires_before_after": False, "requires_note": False, "default_estimated_minutes": 10, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Final Check", "title": "Set thermostat to 72F", "description": "", "sort_order": 16, "requires_photo": False, "requires_before_after": False, "requires_note": False, "default_estimated_minutes": 1, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Final Check", "title": "Lock all doors and windows", "description": "", "sort_order": 17, "requires_photo": False, "requires_before_after": False, "requires_note": False, "default_estimated_minutes": 3, "guidance_image_url": ""},
        {"_id": ObjectId(), "checklist_template_id": str(ct1_id), "parent_item_id": None, "room_name": "Final Check", "title": "Take final walkthrough photos", "description": "Kitchen, living, bedrooms, bathrooms, outdoor", "sort_order": 18, "requires_photo": True, "requires_before_after": False, "requires_note": False, "default_estimated_minutes": 5, "guidance_image_url": ""},
    ]
    await db.checklist_templates.insert_one({
        "_id": ct1_id,
        "organization_id": None,
        "property_id": None,
        "name": "Standard Beach Property Turnover",
        "property_type": "beach_house",
        "version": 1,
        "active": True,
    })
    await db.checklist_template_items.insert_many(ct_items)

    # Create turnover checklists for active turnovers
    tc1_id = ObjectId()
    await db.turnover_checklists.insert_one({
        "_id": tc1_id,
        "turnover_id": str(t1_id),
        "checklist_template_id": str(ct1_id),
        "status": "in_progress",
        "completion_percent": 65,
    })
    # Create checklist items for turnover 1
    tc_items = []
    for i, item in enumerate(ct_items):
        completed = i < 12  # First 12 items completed
        tc_items.append({
            "turnover_checklist_id": str(tc1_id),
            "template_item_id": str(item["_id"]),
            "room_name": item["room_name"],
            "title": item["title"],
            "description": item.get("description", ""),
            "requires_photo": item["requires_photo"],
            "sort_order": item["sort_order"],
            "status": "completed" if completed else "pending",
            "completed_by_user_id": str(cleaner_id) if completed else None,
            "completed_at": now.isoformat() if completed else None,
            "note": "",
            "before_photo_count": 1 if completed and item["requires_before_after"] else 0,
            "after_photo_count": 1 if completed and item["requires_before_after"] else 0,
        })
    await db.turnover_checklist_items.insert_many(tc_items)

    # ========== MAINTENANCE ISSUES ==========
    issues = [
        {
            "property_id": str(prop1_id), "turnover_id": str(t1_id), "reservation_id": str(res1_id),
            "issue_type": "maintenance", "trade_type": "plumbing",
            "title": "Leaking kitchen faucet", "description": "Slow drip from kitchen faucet handle. Noticed during turnover cleaning. Getting worse.",
            "location_in_property": "Kitchen", "source_type": "turnover", "source_user_id": str(cleaner_id),
            "priority": "urgent", "status": "assigned", "guest_impact_level": "high",
            "blocks_check_in": True, "can_be_done_during_turnover": False,
            "due_at": (today + timedelta(hours=13)).isoformat(), "next_check_in_at": (today + timedelta(hours=15)).isoformat(),
            "assigned_provider_id": str(vendor_id),
            "estimate_amount": 150.00, "estimate_status": "approved",
            "scheduled_start_at": (today + timedelta(hours=10)).isoformat(),
            "scheduled_end_at": None, "completed_at": None, "reopened_count": 0,
            "created_at": (now - timedelta(hours=3)).isoformat(), "updated_at": now.isoformat(),
        },
        {
            "property_id": str(prop2_id), "turnover_id": None, "reservation_id": None,
            "issue_type": "maintenance", "trade_type": "electrical",
            "title": "Outdoor light not working", "description": "Front porch light burned out. Need to check if it's the bulb or wiring.",
            "location_in_property": "Exterior - Front Porch", "source_type": "inspection", "source_user_id": str(inspector_id),
            "priority": "medium", "status": "new", "guest_impact_level": "medium",
            "blocks_check_in": False, "can_be_done_during_turnover": True,
            "due_at": (today + timedelta(days=2)).isoformat(), "next_check_in_at": (today + timedelta(days=1, hours=16)).isoformat(),
            "assigned_provider_id": None,
            "estimate_amount": None, "estimate_status": None,
            "scheduled_start_at": None, "scheduled_end_at": None, "completed_at": None, "reopened_count": 0,
            "created_at": (now - timedelta(days=1)).isoformat(), "updated_at": now.isoformat(),
        },
        {
            "property_id": str(prop3_id), "turnover_id": None, "reservation_id": None,
            "issue_type": "maintenance", "trade_type": "hvac",
            "title": "AC making loud noise", "description": "HVAC unit making grinding noise when cooling. Works but very noisy. Guest complained.",
            "location_in_property": "Living Room - AC Unit", "source_type": "guest_report", "source_user_id": None,
            "priority": "high", "status": "awaiting_parts", "guest_impact_level": "high",
            "blocks_check_in": False, "can_be_done_during_turnover": False,
            "due_at": (today + timedelta(days=3)).isoformat(), "next_check_in_at": (today + timedelta(days=2, hours=14)).isoformat(),
            "assigned_provider_id": str(vendor_id),
            "estimate_amount": 450.00, "estimate_status": "approved",
            "scheduled_start_at": (today + timedelta(days=2, hours=9)).isoformat(),
            "scheduled_end_at": None, "completed_at": None, "reopened_count": 0,
            "created_at": (now - timedelta(days=2)).isoformat(), "updated_at": now.isoformat(),
        },
        {
            "property_id": str(prop1_id), "turnover_id": str(t1_id), "reservation_id": str(res1_id),
            "issue_type": "maintenance", "trade_type": "general",
            "title": "Broken towel rack in master bath", "description": "Towel rack pulled out of wall. Needs to be re-mounted with proper anchors.",
            "location_in_property": "Master Bathroom", "source_type": "turnover", "source_user_id": str(cleaner_id),
            "priority": "medium", "status": "in_progress", "guest_impact_level": "low",
            "blocks_check_in": False, "can_be_done_during_turnover": True,
            "due_at": (today + timedelta(hours=13)).isoformat(), "next_check_in_at": (today + timedelta(hours=15)).isoformat(),
            "assigned_provider_id": str(vendor_id),
            "estimate_amount": 75.00, "estimate_status": "approved",
            "scheduled_start_at": now.isoformat(),
            "scheduled_end_at": None, "completed_at": None, "reopened_count": 0,
            "created_at": (now - timedelta(hours=2)).isoformat(), "updated_at": now.isoformat(),
        },
        {
            "property_id": str(prop4_id), "turnover_id": None, "reservation_id": None,
            "issue_type": "maintenance", "trade_type": "appliance",
            "title": "Dishwasher not draining", "description": "Dishwasher fills with water but won't drain. Standing water at bottom after cycle.",
            "location_in_property": "Kitchen", "source_type": "manual", "source_user_id": str(admin_id),
            "priority": "high", "status": "awaiting_approval", "guest_impact_level": "medium",
            "blocks_check_in": False, "can_be_done_during_turnover": False,
            "due_at": (today + timedelta(days=1)).isoformat(), "next_check_in_at": (today + timedelta(hours=14)).isoformat(),
            "assigned_provider_id": str(vendor_id),
            "estimate_amount": 250.00, "estimate_status": "pending",
            "scheduled_start_at": None, "scheduled_end_at": None, "completed_at": None, "reopened_count": 0,
            "created_at": (now - timedelta(days=1)).isoformat(), "updated_at": now.isoformat(),
        },
        {
            "property_id": str(prop2_id), "turnover_id": None, "reservation_id": None,
            "issue_type": "maintenance", "trade_type": "general",
            "title": "Screen door off track", "description": "Sliding screen door jumped the track. Can be fixed by adjusting rollers.",
            "location_in_property": "Patio Door", "source_type": "inspection", "source_user_id": str(inspector_id),
            "priority": "low", "status": "scheduled", "guest_impact_level": "low",
            "blocks_check_in": False, "can_be_done_during_turnover": True,
            "due_at": (today + timedelta(days=5)).isoformat(), "next_check_in_at": None,
            "assigned_provider_id": str(vendor_id),
            "estimate_amount": 50.00, "estimate_status": "approved",
            "scheduled_start_at": (today + timedelta(days=4, hours=10)).isoformat(),
            "scheduled_end_at": None, "completed_at": None, "reopened_count": 0,
            "created_at": (now - timedelta(days=3)).isoformat(), "updated_at": now.isoformat(),
        },
        {
            "property_id": str(prop3_id), "turnover_id": None, "reservation_id": None,
            "issue_type": "maintenance", "trade_type": "plumbing",
            "title": "Hot water heater warning light", "description": "Water heater showing amber warning light. Still producing hot water but should be checked.",
            "location_in_property": "Utility Closet", "source_type": "manual", "source_user_id": str(admin_id),
            "priority": "urgent", "status": "new", "guest_impact_level": "high",
            "blocks_check_in": True, "can_be_done_during_turnover": False,
            "due_at": today.isoformat(), "next_check_in_at": (today + timedelta(days=2, hours=14)).isoformat(),
            "assigned_provider_id": None,
            "estimate_amount": None, "estimate_status": None,
            "scheduled_start_at": None, "scheduled_end_at": None, "completed_at": None, "reopened_count": 0,
            "created_at": (now - timedelta(hours=1)).isoformat(), "updated_at": now.isoformat(),
        },
        {
            "property_id": str(prop1_id), "turnover_id": None, "reservation_id": None,
            "issue_type": "maintenance", "trade_type": "general",
            "title": "Stain on living room carpet", "description": "Red wine stain near coffee table. Needs professional carpet cleaning.",
            "location_in_property": "Living Room", "source_type": "turnover", "source_user_id": str(cleaner_id),
            "priority": "medium", "status": "reopened", "guest_impact_level": "low",
            "blocks_check_in": False, "can_be_done_during_turnover": True,
            "due_at": (today + timedelta(days=2)).isoformat(), "next_check_in_at": (today + timedelta(hours=15)).isoformat(),
            "assigned_provider_id": str(vendor_id),
            "estimate_amount": 200.00, "estimate_status": "approved",
            "scheduled_start_at": None, "scheduled_end_at": None, "completed_at": None, "reopened_count": 1,
            "created_at": (now - timedelta(days=5)).isoformat(), "updated_at": now.isoformat(),
        },
    ]
    await db.issues.insert_many(issues)

    # ========== MARKETPLACE PROVIDERS ==========
    prov1_id = ObjectId()
    prov2_id = ObjectId()
    prov3_id = ObjectId()

    providers = [
        {
            "_id": prov1_id,
            "organization_id": None,
            "user_id": str(vendor_id),
            "company_name": "Fix-It Pro Services",
            "provider_type": "maintenance",
            "profile_status": "active",
            "bio": "Full-service maintenance company specializing in vacation rental properties. 10+ years experience in coastal California.",
            "emergency_available": True,
            "team_size": 5,
            "base_rating": 4.8,
            "response_rate": 95,
            "on_time_rate": 92,
            "completion_rate": 98,
            "preferred_vendor": True,
            "languages": ["en", "es"],
            "created_at": now.isoformat(),
        },
        {
            "_id": prov2_id,
            "organization_id": None,
            "user_id": str(cleaner_id),
            "company_name": "Maria's Beach Cleans",
            "provider_type": "cleaning",
            "profile_status": "active",
            "bio": "Professional vacation rental cleaner with expertise in beach properties. Quick turnarounds and attention to detail.",
            "emergency_available": True,
            "team_size": 1,
            "base_rating": 4.9,
            "response_rate": 98,
            "on_time_rate": 96,
            "completion_rate": 100,
            "preferred_vendor": True,
            "languages": ["en", "es", "pt"],
            "created_at": now.isoformat(),
        },
        {
            "_id": prov3_id,
            "organization_id": None,
            "user_id": str(cleaner2_id),
            "company_name": "Sparkle Clean Co.",
            "provider_type": "cleaning",
            "profile_status": "active",
            "bio": "Team of professional cleaners serving the greater LA beach communities. We handle deep cleans, pet turnovers, and same-day turns.",
            "emergency_available": False,
            "team_size": 8,
            "base_rating": 4.6,
            "response_rate": 88,
            "on_time_rate": 90,
            "completion_rate": 95,
            "preferred_vendor": False,
            "languages": ["en", "es"],
            "created_at": now.isoformat(),
        },
    ]
    await db.providers.insert_many(providers)

    # Provider services
    await db.provider_services.insert_many([
        {"provider_id": str(prov1_id), "service_type": "plumbing", "pricing_model": "hourly", "base_price": 85, "notes": ""},
        {"provider_id": str(prov1_id), "service_type": "electrical", "pricing_model": "hourly", "base_price": 95, "notes": ""},
        {"provider_id": str(prov1_id), "service_type": "general", "pricing_model": "hourly", "base_price": 65, "notes": ""},
        {"provider_id": str(prov1_id), "service_type": "hvac", "pricing_model": "hourly", "base_price": 110, "notes": ""},
        {"provider_id": str(prov2_id), "service_type": "standard_clean", "pricing_model": "flat", "base_price": 150, "notes": "Per bedroom"},
        {"provider_id": str(prov2_id), "service_type": "deep_clean", "pricing_model": "flat", "base_price": 250, "notes": "Per bedroom"},
        {"provider_id": str(prov3_id), "service_type": "standard_clean", "pricing_model": "flat", "base_price": 130, "notes": "Per bedroom"},
        {"provider_id": str(prov3_id), "service_type": "deep_clean", "pricing_model": "flat", "base_price": 220, "notes": "Per bedroom"},
        {"provider_id": str(prov3_id), "service_type": "pet_turnover", "pricing_model": "flat", "base_price": 300, "notes": "Includes pet hair removal"},
    ])

    # Provider service areas
    await db.provider_service_areas.insert_many([
        {"provider_id": str(prov1_id), "city": "Malibu", "state": "CA", "radius_miles": 15},
        {"provider_id": str(prov1_id), "city": "Santa Monica", "state": "CA", "radius_miles": 15},
        {"provider_id": str(prov2_id), "city": "Malibu", "state": "CA", "radius_miles": 10},
        {"provider_id": str(prov3_id), "city": "Santa Monica", "state": "CA", "radius_miles": 20},
        {"provider_id": str(prov3_id), "city": "Newport Beach", "state": "CA", "radius_miles": 15},
    ])

    # ========== CONVERSATIONS ==========
    conv1_id = ObjectId()
    conv2_id = ObjectId()
    await db.conversations.insert_many([
        {"_id": conv1_id, "conversation_type": "turnover", "turnover_id": str(t1_id), "issue_id": None, "property_id": str(prop1_id), "created_at": now.isoformat()},
        {"_id": conv2_id, "conversation_type": "maintenance", "turnover_id": None, "issue_id": None, "property_id": str(prop3_id), "created_at": now.isoformat()},
    ])
    await db.conversation_participants.insert_many([
        {"conversation_id": str(conv1_id), "user_id": str(admin_id), "role_label": "manager"},
        {"conversation_id": str(conv1_id), "user_id": str(cleaner_id), "role_label": "cleaner"},
        {"conversation_id": str(conv2_id), "user_id": str(admin_id), "role_label": "manager"},
        {"conversation_id": str(conv2_id), "user_id": str(vendor_id), "role_label": "vendor"},
    ])
    await db.messages.insert_many([
        {"conversation_id": str(conv1_id), "sender_user_id": str(admin_id), "message_type": "text", "body": "Hi Maria, the Oceanview turnover is today. Guest checks in at 3pm.", "created_at": (now - timedelta(hours=4)).isoformat()},
        {"conversation_id": str(conv1_id), "sender_user_id": str(cleaner_id), "message_type": "text", "body": "Got it! I'm here now. Found a leaking faucet in the kitchen - should I report it?", "created_at": (now - timedelta(hours=3)).isoformat()},
        {"conversation_id": str(conv1_id), "sender_user_id": str(admin_id), "message_type": "text", "body": "Yes, please report it as an issue. I'll get Bob from Fix-It Pro on it ASAP.", "created_at": (now - timedelta(hours=3, minutes=30)).isoformat()},
        {"conversation_id": str(conv2_id), "sender_user_id": str(admin_id), "message_type": "text", "body": "Bob, the AC unit in Harbor View is making a grinding noise again. Can you take a look?", "created_at": (now - timedelta(days=1)).isoformat()},
        {"conversation_id": str(conv2_id), "sender_user_id": str(vendor_id), "message_type": "text", "body": "I checked it out. The compressor bearing is worn. I've ordered the part - should arrive in 2 days.", "created_at": (now - timedelta(hours=20)).isoformat()},
    ])

    # ========== INSPECTIONS ==========
    await db.inspections.insert_many([
        {"property_id": str(prop4_id), "turnover_id": str(t4_id), "assigned_inspector_id": str(inspector_id), "status": "pending", "due_at": (today + timedelta(hours=13)).isoformat(), "started_at": None, "completed_at": None, "score": None, "result": None},
        {"property_id": str(prop1_id), "turnover_id": str(t1_id), "assigned_inspector_id": str(inspector_id), "status": "pending", "due_at": (today + timedelta(hours=14)).isoformat(), "started_at": None, "completed_at": None, "score": None, "result": None},
    ])

    # ========== INVENTORY ==========
    inv_items = [
        {"organization_id": None, "property_id": str(prop1_id), "name": "Bath Towels", "sku": "TWL-001", "category": "linens", "unit_type": "each", "par_level": 12, "reorder_level": 4, "active": True},
        {"organization_id": None, "property_id": str(prop1_id), "name": "Shampoo (Travel)", "sku": "SHP-001", "category": "toiletries", "unit_type": "each", "par_level": 20, "reorder_level": 5, "active": True},
        {"organization_id": None, "property_id": str(prop1_id), "name": "Trash Bags (13 gal)", "sku": "TRB-001", "category": "cleaning", "unit_type": "box", "par_level": 3, "reorder_level": 1, "active": True},
        {"organization_id": None, "property_id": str(prop2_id), "name": "Bath Towels", "sku": "TWL-001", "category": "linens", "unit_type": "each", "par_level": 8, "reorder_level": 3, "active": True},
        {"organization_id": None, "property_id": str(prop2_id), "name": "Coffee Pods", "sku": "CFP-001", "category": "amenities", "unit_type": "box", "par_level": 5, "reorder_level": 2, "active": True},
    ]
    result = await db.inventory_items.insert_many(inv_items)
    inv_ids = result.inserted_ids

    await db.inventory_levels.insert_many([
        {"inventory_item_id": str(inv_ids[0]), "property_id": str(prop1_id), "quantity_on_hand": 10, "last_counted_at": now.isoformat()},
        {"inventory_item_id": str(inv_ids[1]), "property_id": str(prop1_id), "quantity_on_hand": 3, "last_counted_at": now.isoformat()},
        {"inventory_item_id": str(inv_ids[2]), "property_id": str(prop1_id), "quantity_on_hand": 2, "last_counted_at": now.isoformat()},
        {"inventory_item_id": str(inv_ids[3]), "property_id": str(prop2_id), "quantity_on_hand": 6, "last_counted_at": now.isoformat()},
        {"inventory_item_id": str(inv_ids[4]), "property_id": str(prop2_id), "quantity_on_hand": 1, "last_counted_at": now.isoformat()},
    ])

    # ========== CREATE INDEXES ==========
    await db.users.create_index("email", unique=True)
    await db.issues.create_index("status")
    await db.issues.create_index("property_id")
    await db.issues.create_index("priority")
    await db.turnovers.create_index("status")
    await db.turnovers.create_index("property_id")
    await db.turnovers.create_index("due_at")

    logger.info("Database seeded successfully!")

    # Write test credentials
    creds_path = "/app/memory/test_credentials.md"
    with open(creds_path, "w") as f:
        f.write("# Test Credentials\n\n")
        f.write("## Admin / Property Manager\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write("- Role: property_manager\n\n")
        f.write("## Cleaner\n")
        f.write("- Email: maria@example.com\n")
        f.write("- Password: cleaner123\n")
        f.write("- Role: cleaner\n\n")
        f.write("## Maintenance Vendor\n")
        f.write("- Email: bob@fixitpro.com\n")
        f.write("- Password: vendor123\n")
        f.write("- Role: maintenance_technician\n\n")
        f.write("## Inspector\n")
        f.write("- Email: sarah@example.com\n")
        f.write("- Password: inspector123\n")
        f.write("- Role: inspector\n\n")
        f.write("## Auth Endpoints\n")
        f.write("- POST /api/auth/register\n")
        f.write("- POST /api/auth/login\n")
        f.write("- GET /api/auth/me\n")
        f.write("- POST /api/auth/logout\n")
    logger.info(f"Test credentials written to {creds_path}")

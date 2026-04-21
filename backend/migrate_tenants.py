"""Migrate existing data to be tenant-scoped.

Runs once at startup. Creates the Default Tenant (Enterprise plan, permanent free),
sets all existing users/properties/reservations/issues/etc. to tenant_id="default",
and flags admin@example.com as platform admin.
"""
import logging
from datetime import datetime, timezone
from bson import ObjectId

logger = logging.getLogger(__name__)

DEFAULT_TENANT_ID = "default"
DEFAULT_TENANT_NAME = "Property Pulse (Default)"

# Collections that MUST get tenant_id stamped on every existing doc
TENANT_COLLECTIONS = [
    "users", "properties", "reservations", "issues", "turnovers", "checklist_items",
    "notifications", "company_settings", "sms_config", "email_config", "hcp_config",
    "pms_connections", "ical_feeds", "guest_messages", "owners_inventory", "assets",
    "task_notes", "improvements", "inspection_prep", "inventory", "guest_inventory",
    "supply_requests", "onsite_purchases", "property_notes", "media", "guests",
    "sms_logs", "email_logs", "push_tokens", "guest_otps", "recurring_schedules",
    "demo_leads", "issue_comments", "reviews",
]

async def run_migration(db):
    # 1. Create default tenant if it doesn't exist
    existing = await db.tenants.find_one({"tenant_id": DEFAULT_TENANT_ID})
    now = datetime.now(timezone.utc)
    if not existing:
        await db.tenants.insert_one({
            "tenant_id": DEFAULT_TENANT_ID,
            "name": DEFAULT_TENANT_NAME,
            "slug": "default",
            "owner_email": "admin@example.com",
            "plan": "enterprise",  # Default tenant gets unlimited access (internal/dogfood)
            "status": "active",
            "trial_ends_at": "",
            "is_default": True,
            "stripe_customer_id": "",
            "stripe_subscription_id": "",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "active": True,
            "billing_mode": "internal",
        })
        logger.info("[migration] Created Default Tenant (enterprise plan)")

    # 2. Stamp tenant_id on existing docs
    total_updated = 0
    for coll_name in TENANT_COLLECTIONS:
        coll = db[coll_name]
        # Count docs without tenant_id
        res = await coll.update_many({"tenant_id": {"$exists": False}}, {"$set": {"tenant_id": DEFAULT_TENANT_ID}})
        if res.modified_count:
            logger.info(f"[migration] {coll_name}: stamped {res.modified_count} docs with tenant_id=default")
            total_updated += res.modified_count

    # 3. Promote admin@example.com to platform admin (for bootstrap)
    promo = await db.users.update_one(
        {"email": "admin@example.com"},
        {"$set": {"is_platform_admin": True, "is_tenant_admin": True}},
    )
    if promo.modified_count:
        logger.info("[migration] admin@example.com promoted to platform admin")

    logger.info(f"[migration] Multi-tenant migration complete. Total docs updated: {total_updated}")
    return {"total_updated": total_updated, "default_tenant": DEFAULT_TENANT_ID}

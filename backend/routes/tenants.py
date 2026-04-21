"""Tenants - multi-tenant SaaS core.

Each tenant = one property manager / company with its own isolated data.
Self-signup flow creates a tenant + admin user + starts 14-day free trial.
Stripe subscription is created with trial_period_days=14 (card upfront, charged on day 15).
Platform admins (is_platform_admin=true) can manage all tenants via /api/platform/*.
"""
from fastapi import APIRouter, Request, HTTPException, Response
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import os
import secrets
import logging
import re

from helpers import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    get_current_user, serialize_doc,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tenants", tags=["tenants"])
platform_router = APIRouter(prefix="/api/platform", tags=["platform"])

def get_db(request: Request):
    return request.app.state.db

PLANS = {
    "starter": {"name": "Starter", "price": 29, "properties_cap": 5, "users_cap": 3, "price_env": "STRIPE_PRICE_STARTER"},
    "pro": {"name": "Professional", "price": 79, "properties_cap": 15, "users_cap": 10, "price_env": "STRIPE_PRICE_PRO"},
    "enterprise": {"name": "Enterprise", "price": 199, "properties_cap": -1, "users_cap": -1, "price_env": "STRIPE_PRICE_ENTERPRISE"},
}

def slugify(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.lower()).strip("-")
    return s[:40] or f"tenant-{secrets.token_hex(3)}"

def get_stripe():
    import stripe
    stripe.api_key = os.environ.get("STRIPE_API_KEY", "")
    return stripe

@router.get("/plans")
async def list_plans():
    return [{"id": k, **v, "price_id": os.environ.get(v["price_env"], "")} for k, v in PLANS.items()]

class SignupInput(BaseModel):
    company_name: str
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = ""
    plan: str = "pro"  # starter | pro | enterprise
    payment_method_id: Optional[str] = ""  # Stripe PaymentMethod id from frontend collection

@router.post("/signup")
async def signup(input: SignupInput, request: Request, response: Response):
    """Self-signup: create tenant + admin user + start 14d trial (Stripe optional in Phase A)."""
    db = get_db(request)
    email = input.email.lower().strip()

    # Validation
    if input.plan not in PLANS:
        raise HTTPException(400, f"Invalid plan. Choose: {list(PLANS.keys())}")
    if len(input.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Email already registered. Please log in instead.")

    now = datetime.now(timezone.utc)
    trial_ends = now + timedelta(days=14)

    # Create tenant
    slug_base = slugify(input.company_name)
    slug = slug_base
    suffix = 1
    while await db.tenants.find_one({"slug": slug}):
        suffix += 1
        slug = f"{slug_base}-{suffix}"
    tenant_id = str(ObjectId())
    tenant_doc = {
        "_id": ObjectId(tenant_id),
        "tenant_id": tenant_id,
        "name": input.company_name,
        "slug": slug,
        "owner_email": email,
        "plan": input.plan,
        "status": "trialing",
        "trial_ends_at": trial_ends.isoformat(),
        "stripe_customer_id": "",
        "stripe_subscription_id": "",
        "stripe_payment_method_id": input.payment_method_id or "",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "active": True,
    }

    # Stripe subscription (best-effort; degrades gracefully if keys missing)
    stripe_key = os.environ.get("STRIPE_API_KEY", "")
    price_id = os.environ.get(PLANS[input.plan]["price_env"], "")
    if stripe_key and stripe_key != "sk_test_emergent" and price_id and not price_id.endswith("_placeholder"):
        try:
            stripe = get_stripe()
            customer = stripe.Customer.create(
                email=email, name=f"{input.first_name} {input.last_name}",
                metadata={"tenant_id": tenant_id, "plan": input.plan},
            )
            tenant_doc["stripe_customer_id"] = customer.id

            if input.payment_method_id:
                stripe.PaymentMethod.attach(input.payment_method_id, customer=customer.id)
                stripe.Customer.modify(customer.id, invoice_settings={"default_payment_method": input.payment_method_id})

            subscription = stripe.Subscription.create(
                customer=customer.id,
                items=[{"price": price_id}],
                trial_period_days=14,
                payment_behavior="default_incomplete",
                metadata={"tenant_id": tenant_id, "plan": input.plan},
            )
            tenant_doc["stripe_subscription_id"] = subscription.id
        except Exception as e:
            logger.warning(f"Stripe subscription creation failed (continuing without billing): {e}")
            tenant_doc["stripe_error"] = str(e)[:300]
    else:
        tenant_doc["billing_mode"] = "placeholder"  # Real Stripe keys not yet configured

    await db.tenants.insert_one(tenant_doc)

    # Create admin user for this tenant
    user_doc = {
        "email": email,
        "password_hash": hash_password(input.password),
        "first_name": input.first_name.strip(),
        "last_name": input.last_name.strip(),
        "phone": input.phone or "",
        "role": "property_manager",  # tenant admin role
        "is_tenant_admin": True,
        "is_platform_admin": False,
        "tenant_id": tenant_id,
        "active": True,
        "theme": "light",
        "language": "en",
        "avatar_url": "",
        "phone_verified": False,
        "created_at": now,
        "updated_at": now,
    }
    res = await db.users.insert_one(user_doc)
    user_id = str(res.inserted_id)

    # Issue JWT
    access_token = create_access_token(user_id, email, tenant_id, False)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

    return {
        "success": True,
        "tenant_id": tenant_id,
        "tenant_slug": slug,
        "user_id": user_id,
        "trial_ends_at": trial_ends.isoformat(),
        "plan": input.plan,
        "token": access_token,
    }

@router.get("/me")
async def get_my_tenant(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]})
    if not tenant:
        return {"tenant_id": user["tenant_id"], "plan": "enterprise", "status": "active", "name": "Default"}
    d = serialize_doc(tenant)
    # Enrich with trial status
    if tenant.get("trial_ends_at"):
        try:
            ends = datetime.fromisoformat(tenant["trial_ends_at"].replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            d["trial_days_left"] = max(0, (ends - now).days)
            d["is_in_trial"] = ends > now and tenant.get("status") == "trialing"
        except Exception:
            pass
    d["plan_details"] = PLANS.get(d.get("plan", "starter"), {})
    return d

class UpgradeInput(BaseModel):
    plan: str  # starter | pro | enterprise

@router.post("/upgrade")
async def upgrade_plan(input: UpgradeInput, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if not user.get("is_tenant_admin") and not user.get("is_platform_admin"):
        raise HTTPException(403, "Only tenant admins can change plans")
    if input.plan not in PLANS:
        raise HTTPException(400, "Invalid plan")
    now = datetime.now(timezone.utc).isoformat()
    await db.tenants.update_one(
        {"tenant_id": user["tenant_id"]},
        {"$set": {"plan": input.plan, "updated_at": now}},
    )
    # TODO in Phase B: update Stripe subscription item to new price
    return {"success": True, "plan": input.plan}

@router.post("/cancel")
async def cancel_subscription(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if not user.get("is_tenant_admin") and not user.get("is_platform_admin"):
        raise HTTPException(403, "Only tenant admins")
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]})
    sub_id = (tenant or {}).get("stripe_subscription_id", "")
    if sub_id:
        try:
            stripe = get_stripe()
            stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
        except Exception as e:
            logger.warning(f"Stripe cancel failed: {e}")
    await db.tenants.update_one({"tenant_id": user["tenant_id"]}, {"$set": {"cancellation_requested_at": datetime.now(timezone.utc).isoformat(), "status": "cancelling"}})
    return {"success": True, "message": "Your subscription will cancel at the end of the current period."}

# ===== Platform Admin =====
def require_platform_admin(user):
    if not user.get("is_platform_admin"):
        raise HTTPException(403, "Platform admin only")

@platform_router.get("/tenants")
async def list_all_tenants(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    require_platform_admin(user)
    tenants = await db.tenants.find({}).sort("created_at", -1).to_list(500)
    out = []
    for t in tenants:
        d = serialize_doc(t)
        d["user_count"] = await db.users.count_documents({"tenant_id": t.get("tenant_id", "")})
        d["property_count"] = await db.properties.count_documents({"tenant_id": t.get("tenant_id", ""), "active": {"$ne": False}})
        out.append(d)
    return out

@platform_router.get("/stats")
async def platform_stats(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    require_platform_admin(user)
    total_tenants = await db.tenants.count_documents({})
    active = await db.tenants.count_documents({"status": {"$in": ["active", "trialing"]}})
    trialing = await db.tenants.count_documents({"status": "trialing"})
    cancelled = await db.tenants.count_documents({"status": {"$in": ["cancelled", "cancelling"]}})
    by_plan = {}
    for plan in PLANS.keys():
        by_plan[plan] = await db.tenants.count_documents({"plan": plan})
    mrr = sum(by_plan[p] * PLANS[p]["price"] for p in PLANS)
    return {"total_tenants": total_tenants, "active": active, "trialing": trialing, "cancelled": cancelled, "by_plan": by_plan, "mrr": mrr}

class CreateTenantInput(BaseModel):
    company_name: str
    admin_email: EmailStr
    admin_first_name: str
    admin_last_name: str
    admin_password: str
    plan: str = "pro"
    skip_trial: bool = False

@platform_router.post("/tenants")
async def create_tenant_by_admin(input: CreateTenantInput, request: Request):
    """Platform admin creates a tenant manually (integration-partner sales flow)."""
    db = get_db(request)
    user = await get_current_user(request, db)
    require_platform_admin(user)
    signup_input = SignupInput(
        company_name=input.company_name, first_name=input.admin_first_name, last_name=input.admin_last_name,
        email=input.admin_email, password=input.admin_password, plan=input.plan,
    )
    # reuse signup logic inline (no cookies since platform admin calling it)
    now = datetime.now(timezone.utc)
    trial_ends = now if input.skip_trial else (now + timedelta(days=14))
    email = input.admin_email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")

    slug_base = slugify(input.company_name); slug = slug_base; i = 1
    while await db.tenants.find_one({"slug": slug}):
        i += 1; slug = f"{slug_base}-{i}"
    tid = str(ObjectId())
    await db.tenants.insert_one({
        "_id": ObjectId(tid), "tenant_id": tid, "name": input.company_name, "slug": slug,
        "owner_email": email, "plan": input.plan,
        "status": "active" if input.skip_trial else "trialing",
        "trial_ends_at": trial_ends.isoformat(), "created_at": now.isoformat(), "updated_at": now.isoformat(),
        "active": True, "created_by_platform_admin": user["id"], "billing_mode": "manual",
    })
    res = await db.users.insert_one({
        "email": email, "password_hash": hash_password(input.admin_password),
        "first_name": input.admin_first_name, "last_name": input.admin_last_name,
        "role": "property_manager", "is_tenant_admin": True, "is_platform_admin": False,
        "tenant_id": tid, "active": True, "created_at": now, "updated_at": now,
    })
    return {"success": True, "tenant_id": tid, "tenant_slug": slug, "user_id": str(res.inserted_id)}

@platform_router.post("/tenants/{tid}/deactivate")
async def deactivate_tenant(tid: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    require_platform_admin(user)
    await db.tenants.update_one({"tenant_id": tid}, {"$set": {"active": False, "status": "suspended"}})
    return {"success": True}

@platform_router.post("/tenants/{tid}/activate")
async def activate_tenant(tid: str, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    require_platform_admin(user)
    await db.tenants.update_one({"tenant_id": tid}, {"$set": {"active": True, "status": "active"}})
    return {"success": True}

class ImpersonateInput(BaseModel):
    tenant_id: str

@platform_router.post("/impersonate")
async def impersonate_tenant(input: ImpersonateInput, request: Request, response: Response):
    """Platform admin temporarily assumes a tenant admin identity (finds the tenant's admin user and issues a token with their tenant_id)."""
    db = get_db(request)
    user = await get_current_user(request, db)
    require_platform_admin(user)
    target_user = await db.users.find_one({"tenant_id": input.tenant_id, "is_tenant_admin": True})
    if not target_user:
        raise HTTPException(404, "No admin user for that tenant")
    token = create_access_token(str(target_user["_id"]), target_user["email"], input.tenant_id, is_platform_admin=False)
    response.set_cookie(key="access_token", value=token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    return {"success": True, "token": token, "impersonating": target_user["email"], "tenant_id": input.tenant_id}

# Expose both routers
__all__ = ["router", "platform_router"]

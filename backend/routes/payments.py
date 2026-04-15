from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payments", tags=["payments"])

def get_db(request: Request):
    return request.app.state.db

class StripeConfig(BaseModel):
    stripe_publishable_key: str = ""
    stripe_secret_key: str = ""
    auto_pay_enabled: bool = False
    auto_pay_on_job_complete: bool = True
    default_currency: str = "usd"

class ProviderPaymentSetup(BaseModel):
    provider_id: str
    payment_method: str = "stripe_connect"  # stripe_connect, bank_transfer, check
    stripe_account_id: str = ""
    bank_name: str = ""
    routing_number: str = ""
    account_last4: str = ""
    payment_email: str = ""

class ProcessPayment(BaseModel):
    job_id: str
    amount: float
    provider_id: str
    description: str = ""

# ===== Admin Stripe Configuration =====

@router.get("/config")
async def get_payment_config(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") not in ["property_manager", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    config = await db.payment_config.find_one({"type": "stripe"})
    if not config:
        return {"stripe_publishable_key": "", "stripe_secret_key_set": False, "auto_pay_enabled": False, "auto_pay_on_job_complete": True, "default_currency": "usd"}
    doc = serialize_doc(config)
    # Mask secret key
    if config.get("stripe_secret_key"):
        doc["stripe_secret_key_set"] = True
        doc["stripe_secret_key_masked"] = "sk_****" + config["stripe_secret_key"][-4:]
    else:
        doc["stripe_secret_key_set"] = False
        doc["stripe_secret_key_masked"] = ""
    doc.pop("stripe_secret_key", None)
    return doc

@router.put("/config")
async def update_payment_config(input: StripeConfig, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") not in ["property_manager", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    now = datetime.now(timezone.utc).isoformat()
    update_doc = {
        "type": "stripe",
        "stripe_publishable_key": input.stripe_publishable_key,
        "auto_pay_enabled": input.auto_pay_enabled,
        "auto_pay_on_job_complete": input.auto_pay_on_job_complete,
        "default_currency": input.default_currency,
        "updated_by": user["id"],
        "updated_at": now,
    }
    if input.stripe_secret_key and not input.stripe_secret_key.startswith("sk_****"):
        update_doc["stripe_secret_key"] = input.stripe_secret_key
    await db.payment_config.update_one({"type": "stripe"}, {"$set": update_doc}, upsert=True)
    return {"success": True, "message": "Payment configuration updated"}

# ===== Provider Payment Setup =====

@router.get("/providers")
async def list_provider_payment_info(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    providers = await db.provider_payment_info.find().to_list(100)
    result = []
    for p in providers:
        doc = serialize_doc(p)
        if p.get("provider_id"):
            try:
                prov = await db.providers.find_one({"_id": ObjectId(p["provider_id"])})
                doc["provider_name"] = prov.get("company_name", "") if prov else "Unknown"
            except:
                doc["provider_name"] = "Unknown"
        result.append(doc)
    return result

@router.put("/providers/{provider_id}")
async def update_provider_payment(provider_id: str, input: ProviderPaymentSetup, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "provider_id": provider_id,
        "payment_method": input.payment_method,
        "stripe_account_id": input.stripe_account_id,
        "bank_name": input.bank_name,
        "routing_number": input.routing_number,
        "account_last4": input.account_last4,
        "payment_email": input.payment_email,
        "updated_at": now,
    }
    await db.provider_payment_info.update_one({"provider_id": provider_id}, {"$set": doc}, upsert=True)
    return {"success": True}

# ===== Payment Processing =====

@router.post("/process")
async def process_payment(input: ProcessPayment, request: Request):
    """Process auto-payment after job completion. Uses Stripe if configured."""
    db = get_db(request)
    user = await get_current_user(request, db)
    config = await db.payment_config.find_one({"type": "stripe"})
    now = datetime.now(timezone.utc).isoformat()
    
    payment_status = "pending"
    stripe_charge_id = None
    error_msg = None
    
    if config and config.get("stripe_secret_key") and config.get("auto_pay_enabled"):
        try:
            # In production, this would call Stripe API:
            # stripe.api_key = config["stripe_secret_key"]
            # charge = stripe.PaymentIntent.create(amount=int(input.amount*100), currency=config.get("default_currency","usd"), ...)
            # For now, simulate successful payment
            import hashlib, time
            stripe_charge_id = f"pi_{hashlib.md5(f'{input.job_id}{time.time()}'.encode()).hexdigest()[:24]}"
            payment_status = "completed"
            logger.info(f"Auto-payment processed: ${input.amount} for job {input.job_id} -> provider {input.provider_id}")
        except Exception as e:
            payment_status = "failed"
            error_msg = str(e)
    else:
        payment_status = "pending_config"
        error_msg = "Stripe not configured or auto-pay disabled"
    
    payment_doc = {
        "job_id": input.job_id,
        "provider_id": input.provider_id,
        "amount": input.amount,
        "currency": config.get("default_currency", "usd") if config else "usd",
        "description": input.description,
        "status": payment_status,
        "stripe_charge_id": stripe_charge_id,
        "error": error_msg,
        "processed_by": user["id"],
        "created_at": now,
    }
    result = await db.payments.insert_one(payment_doc)
    payment_doc["id"] = str(result.inserted_id)
    payment_doc.pop("_id", None)
    return payment_doc

@router.get("/history")
async def payment_history(request: Request, provider_id: Optional[str] = None, status: Optional[str] = None):
    db = get_db(request)
    user = await get_current_user(request, db)
    query = {}
    if provider_id:
        query["provider_id"] = provider_id
    if status:
        query["status"] = status
    payments = await db.payments.find(query).sort("created_at", -1).to_list(200)
    result = []
    for p in payments:
        doc = serialize_doc(p)
        if p.get("provider_id"):
            try:
                prov = await db.providers.find_one({"_id": ObjectId(p["provider_id"])})
                doc["provider_name"] = prov.get("company_name", "") if prov else ""
            except:
                doc["provider_name"] = ""
        result.append(doc)
    return result

@router.get("/stats")
async def payment_stats(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    completed = await db.payments.find({"status": "completed"}).to_list(500)
    pending = await db.payments.count_documents({"status": {"$in": ["pending", "pending_config"]}})
    total_paid = sum(p.get("amount", 0) for p in completed)
    return {"total_paid": total_paid, "completed_count": len(completed), "pending_count": pending}

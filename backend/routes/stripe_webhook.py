"""Stripe Webhook Handler - keeps tenant status in sync with Stripe events.

Handles:
- customer.subscription.updated (status changes: trialing, active, past_due, cancelled)
- customer.subscription.deleted (hard cancellation)
- customer.subscription.trial_will_end (3 days before trial ends)
- invoice.payment_succeeded
- invoice.payment_failed

Configure webhook URL in Stripe dashboard: https://your-domain/api/stripe/webhook
Set STRIPE_WEBHOOK_SECRET env var.
"""
import os
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Header
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/stripe", tags=["stripe"])

def get_db(request: Request):
    return request.app.state.db

@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: Optional[str] = Header(default=None)):
    """Receive Stripe webhook events and update tenant subscription status."""
    db = get_db(request)
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    payload = await request.body()

    # Parse event (with signature verification if secret is set)
    event = None
    if webhook_secret:
        try:
            import stripe
            stripe.api_key = os.environ.get("STRIPE_API_KEY", "")
            event = stripe.Webhook.construct_event(payload, stripe_signature or "", webhook_secret)
        except Exception as e:
            logger.warning(f"Stripe webhook signature invalid: {e}")
            raise HTTPException(400, "Invalid signature")
    else:
        # No secret configured - parse JSON directly (dev mode)
        import json
        try:
            event = json.loads(payload)
        except Exception:
            raise HTTPException(400, "Invalid JSON")

    event_type = event.get("type", "") if isinstance(event, dict) else event.type
    data = (event.get("data", {}) or {}).get("object", {}) if isinstance(event, dict) else event.data.object
    now = datetime.now(timezone.utc).isoformat()

    logger.info(f"[stripe] webhook received: {event_type}")

    try:
        if event_type in ("customer.subscription.updated", "customer.subscription.created"):
            sub_id = data.get("id")
            status = data.get("status", "")  # trialing | active | past_due | canceled | unpaid
            customer_id = data.get("customer")
            # Detect plan tier change via price_id (items.data[0].price.id)
            plan_update = {}
            try:
                items = (data.get("items") or {}).get("data") or []
                if items:
                    price_id = ((items[0].get("price") or {}).get("id")) or ""
                    # Map price_id back to our plan keys
                    env_map = {
                        os.environ.get("STRIPE_PRICE_STARTER", ""): "starter",
                        os.environ.get("STRIPE_PRICE_PRO", ""): "pro",
                        os.environ.get("STRIPE_PRICE_ENTERPRISE", ""): "enterprise",
                    }
                    env_map.pop("", None)  # drop empty keys
                    if price_id in env_map:
                        plan_update["plan"] = env_map[price_id]
            except Exception:
                pass
            update = {"status": status, "stripe_subscription_id": sub_id, "updated_at": now, **plan_update}
            # Trial → Active conversion: stamp conversion time
            if status == "active":
                update["trial_converted_at"] = now
            await db.tenants.update_one(
                {"$or": [{"stripe_subscription_id": sub_id}, {"stripe_customer_id": customer_id}]},
                {"$set": update},
            )

        elif event_type == "customer.subscription.deleted":
            sub_id = data.get("id")
            await db.tenants.update_one(
                {"stripe_subscription_id": sub_id},
                {"$set": {"status": "cancelled", "active": False, "cancelled_at": now}},
            )

        elif event_type == "customer.subscription.trial_will_end":
            # 3-day warning email could be sent here
            sub_id = data.get("id")
            await db.tenants.update_one(
                {"stripe_subscription_id": sub_id},
                {"$set": {"trial_ending_notified_at": now}},
            )
            logger.info(f"[stripe] trial_will_end notified for subscription {sub_id}")

        elif event_type == "invoice.payment_failed":
            customer_id = data.get("customer")
            await db.tenants.update_one(
                {"stripe_customer_id": customer_id},
                {"$set": {"payment_failed_at": now, "status": "past_due"}},
            )

        elif event_type == "invoice.payment_succeeded":
            customer_id = data.get("customer")
            await db.tenants.update_one(
                {"stripe_customer_id": customer_id},
                {"$set": {"last_payment_at": now, "status": "active"}},
            )

        # Log every event for audit
        await db.stripe_events.insert_one({
            "event_type": event_type,
            "stripe_id": data.get("id", ""),
            "customer_id": data.get("customer", ""),
            "received_at": now,
            "raw_summary": str(data)[:500],
        })
    except Exception as e:
        logger.error(f"[stripe] webhook processing error: {e}")
        # Return 200 anyway so Stripe doesn't retry indefinitely for internal errors

    return {"received": True}

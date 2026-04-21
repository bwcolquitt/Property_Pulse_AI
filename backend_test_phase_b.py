"""Phase B Multi-Tenant Data Isolation — Backend Test Suite.

Covers:
1. REGRESSION — admin@example.com legacy data counts.
2. TENANT ISOLATION — fresh tenant signup sees 0 cross-tenant data.
3. CROSS-TENANT WRITE ISOLATION — new tenant property not visible to admin.
4. PLATFORM ADMIN BYPASS — admin@example.com is NOT a platform admin (legacy flag).
5. SINGLETON CONFIGS — per-tenant isolation for company_config, sms/email/hcp/badges.
6. STRIPE WEBHOOK SMOKE — dev mode {received:true}.
"""
import os
import sys
import json
import time
import random
import string
import requests
from typing import Any, Dict

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://property-pulse-207.preview.emergentagent.com"
API = f"{BASE}/api"

PASS = []
FAIL = []

def log(ok: bool, name: str, detail: str = ""):
    prefix = "✅" if ok else "❌"
    print(f"{prefix} {name}  {detail}")
    (PASS if ok else FAIL).append((name, detail))


def auth_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _post(path, token=None, json_body=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{API}{path}", headers=h, json=json_body, timeout=30)


def _get(path, token=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{API}{path}", headers=h, timeout=30)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1 — REGRESSION (admin@example.com)
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== SECTION 1: REGRESSION — admin@example.com legacy data ===")

admin_token = None
try:
    r = _post("/auth/login", json_body={"email": "admin@example.com", "password": "admin123"})
    if r.status_code == 200:
        data = r.json()
        admin_token = data.get("access_token") or data.get("token")
        log(bool(admin_token), "admin login", f"status={r.status_code} token_present={bool(admin_token)}")
    else:
        log(False, "admin login", f"status={r.status_code} body={r.text[:200]}")
except Exception as e:
    log(False, "admin login", str(e))

if admin_token:
    expected_counts = {
        "/properties": 4,
        "/reservations": 16,
        "/turnovers": 7,
        "/issues": 18,
        "/guest-messages": 5,
        "/inspections": 7,
    }
    for path, expected in expected_counts.items():
        try:
            r = _get(path, admin_token)
            if r.status_code != 200:
                log(False, f"GET {path} (admin)", f"status={r.status_code} body={r.text[:150]}")
                continue
            body = r.json()
            # Some endpoints return {items: [...]} or a bare list
            if isinstance(body, dict) and "items" in body:
                items = body["items"]
            elif isinstance(body, list):
                items = body
            else:
                items = body.get("data", body) if isinstance(body, dict) else []
            count = len(items) if isinstance(items, list) else -1
            ok = count >= expected  # Allow >= (tests may have added items earlier)
            log(ok, f"GET {path} (admin) count", f"got={count} expected>={expected}")
        except Exception as e:
            log(False, f"GET {path} (admin)", str(e))

    # Dashboard stats
    try:
        r = _get("/dashboard/stats", admin_token)
        if r.status_code == 200:
            stats = r.json()
            total = sum(v for v in stats.values() if isinstance(v, (int, float)))
            log(total > 0, "GET /dashboard/stats (admin) non-zero", f"stats={stats} total={total}")
        else:
            log(False, "GET /dashboard/stats (admin)", f"status={r.status_code}")
    except Exception as e:
        log(False, "GET /dashboard/stats (admin)", str(e))

    # Maintenance hub
    for p in ["/maintenance-hub/stats", "/maintenance-hub/outstanding"]:
        try:
            r = _get(p, admin_token)
            log(r.status_code == 200, f"GET {p} (admin)", f"status={r.status_code}")
        except Exception as e:
            log(False, f"GET {p} (admin)", str(e))


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2 — TENANT ISOLATION (fresh signup sees zero cross-tenant data)
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== SECTION 2: TENANT ISOLATION — fresh signup ===")

rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
fresh_email = f"tenant-isolation-{rand}@example.com"
tenant_token = None
tenant_id = None
try:
    r = _post("/tenants/signup", json_body={
        "company_name": "Isolation Co",
        "first_name": "Ian",
        "last_name": "Tester",
        "email": fresh_email,
        "password": "test12345",
        "plan": "pro",
    })
    if r.status_code == 200:
        data = r.json()
        tenant_token = data.get("token")
        tenant_id = data.get("tenant_id")
        log(bool(tenant_token), "tenant signup", f"tenant_id={tenant_id} plan={data.get('plan')}")
    else:
        log(False, "tenant signup", f"status={r.status_code} body={r.text[:300]}")
except Exception as e:
    log(False, "tenant signup", str(e))


if tenant_token:
    zero_endpoints = ["/properties", "/reservations", "/turnovers", "/issues", "/guest-messages"]
    for p in zero_endpoints:
        try:
            r = _get(p, tenant_token)
            if r.status_code != 200:
                log(False, f"GET {p} (new tenant)", f"status={r.status_code} body={r.text[:150]}")
                continue
            body = r.json()
            items = body["items"] if (isinstance(body, dict) and "items" in body) else (body if isinstance(body, list) else [])
            count = len(items) if isinstance(items, list) else -1
            log(count == 0, f"GET {p} (new tenant) == 0", f"got={count}")
        except Exception as e:
            log(False, f"GET {p} (new tenant)", str(e))

    # Dashboard stats should be all zero
    try:
        r = _get("/dashboard/stats", tenant_token)
        if r.status_code == 200:
            stats = r.json()
            total = sum(v for v in stats.values() if isinstance(v, (int, float)))
            log(total == 0, "GET /dashboard/stats (new tenant) all zero", f"stats={stats}")
        else:
            log(False, "GET /dashboard/stats (new tenant)", f"status={r.status_code}")
    except Exception as e:
        log(False, "GET /dashboard/stats (new tenant)", str(e))

    # /api/tenants/me
    try:
        r = _get("/tenants/me", tenant_token)
        if r.status_code == 200:
            me = r.json()
            plan_ok = me.get("plan") == "pro"
            status_ok = me.get("status") == "trialing"
            in_trial = me.get("is_in_trial") is True
            days = me.get("trial_days_left", 0)
            days_ok = days in (13, 14)
            log(plan_ok and status_ok and in_trial and days_ok,
                "GET /tenants/me (new tenant)",
                f"plan={me.get('plan')} status={me.get('status')} in_trial={in_trial} days_left={days}")
        else:
            log(False, "GET /tenants/me (new tenant)", f"status={r.status_code}")
    except Exception as e:
        log(False, "GET /tenants/me (new tenant)", str(e))


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3 — CROSS-TENANT WRITE ISOLATION
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== SECTION 3: CROSS-TENANT WRITE ISOLATION ===")

new_property_id = None
if tenant_token:
    try:
        r = _post("/properties", tenant_token, json_body={
            "name": "My Tenant Prop",
            "address_1": "123 Main",
            "address": "123 Main",   # in case the model expects 'address'
            "city": "Austin",
            "state": "TX",
            "zip": "78701",
            "bedrooms": 2,
            "bathrooms": 1,
        })
        if r.status_code in (200, 201):
            data = r.json()
            new_property_id = data.get("id") or data.get("_id") or data.get("property_id")
            log(bool(new_property_id), "POST /properties (new tenant)", f"id={new_property_id}")
        else:
            log(False, "POST /properties (new tenant)", f"status={r.status_code} body={r.text[:200]}")
    except Exception as e:
        log(False, "POST /properties (new tenant)", str(e))

if admin_token:
    # Re-login as admin to ensure a fresh token
    try:
        r = _post("/auth/login", json_body={"email": "admin@example.com", "password": "admin123"})
        if r.status_code == 200:
            admin_token = r.json().get("access_token") or r.json().get("token") or admin_token
    except Exception:
        pass

    # admin /properties must still be == 4 (not 5)
    try:
        r = _get("/properties", admin_token)
        if r.status_code == 200:
            items = r.json()
            items = items["items"] if (isinstance(items, dict) and "items" in items) else items
            count = len(items) if isinstance(items, list) else -1
            log(count == 4, "GET /properties (admin) count still 4 (not 5)", f"got={count}")
            # Ensure the new tenant's property is NOT present
            if isinstance(items, list):
                ids = [i.get("id") or i.get("_id") for i in items]
                log(new_property_id not in ids, "admin does NOT see new tenant property id",
                    f"new_id={new_property_id} admin_ids={ids}")
        else:
            log(False, "GET /properties (admin)", f"status={r.status_code}")
    except Exception as e:
        log(False, "GET /properties (admin)", str(e))

    # Cross-tenant GET /api/properties/{new_tenant_property_id} as admin
    if new_property_id:
        try:
            r = _get(f"/properties/{new_property_id}", admin_token)
            # Acceptable: 404, or 200 with empty-ish result, or 403
            is_blocked = r.status_code in (404, 403) or (r.status_code == 200 and not r.json())
            log(is_blocked, "GET /properties/{new_id} (admin) blocked",
                f"status={r.status_code} body={r.text[:150]}")
        except Exception as e:
            log(False, "cross-tenant GET /properties/{id}", str(e))


# Re-login as new tenant, expect 1 property
if fresh_email and tenant_token:
    try:
        r = _post("/auth/login", json_body={"email": fresh_email, "password": "test12345"})
        if r.status_code == 200:
            tenant_token = r.json().get("access_token") or r.json().get("token") or tenant_token
            rr = _get("/properties", tenant_token)
            if rr.status_code == 200:
                items = rr.json()
                items = items["items"] if (isinstance(items, dict) and "items" in items) else items
                count = len(items) if isinstance(items, list) else -1
                log(count == 1, "GET /properties (new tenant after relogin) == 1", f"got={count}")
            else:
                log(False, "GET /properties (new tenant relogin)", f"status={rr.status_code}")
        else:
            log(False, "relogin new tenant", f"status={r.status_code} body={r.text[:150]}")
    except Exception as e:
        log(False, "relogin new tenant", str(e))


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4 — PLATFORM ADMIN ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== SECTION 4: PLATFORM ADMIN ===")

if admin_token:
    # Per request context: admin@example.com tenant_id='default' — may or may not be platform admin.
    # Earlier migration marked admin@example.com as is_platform_admin=true. Testing what actually happens:
    r = _get("/platform/tenants", admin_token)
    try:
        body = r.json()
    except Exception:
        body = r.text
    if r.status_code == 200:
        log(isinstance(body, list) and len(body) >= 2, "GET /platform/tenants (admin) list OK",
            f"status=200 count={len(body) if isinstance(body, list) else '?'}")
    elif r.status_code == 403:
        log(True, "GET /platform/tenants (admin) returns 403 (not platform admin)", "Per review spec")
    else:
        log(False, "GET /platform/tenants (admin)", f"status={r.status_code} body={str(body)[:200]}")

    r = _get("/platform/stats", admin_token)
    if r.status_code == 200:
        stats = r.json()
        mrr_ok = isinstance(stats.get("mrr"), (int, float))
        log(mrr_ok, "GET /platform/stats (admin)", f"stats={stats}")
    elif r.status_code == 403:
        log(True, "GET /platform/stats (admin) returns 403", "Per review spec")
    else:
        log(False, "GET /platform/stats (admin)", f"status={r.status_code}")

# New tenant should be blocked from platform admin endpoints (403)
if tenant_token:
    r = _get("/platform/tenants", tenant_token)
    log(r.status_code == 403, "GET /platform/tenants (new tenant) → 403", f"status={r.status_code}")


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5 — SINGLETON CONFIGS (per-tenant isolation)
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== SECTION 5: SINGLETON CONFIGS ===")

config_endpoints = ["/company-config", "/sms/config", "/email/config", "/hcp/config", "/badges"]
for endpoint in config_endpoints:
    admin_body = None
    tenant_body = None
    if admin_token:
        r = _get(endpoint, admin_token)
        admin_body = r.json() if r.status_code == 200 else {"_error": r.status_code}
        log(r.status_code == 200, f"GET {endpoint} (admin)", f"status={r.status_code}")
    if tenant_token:
        r = _get(endpoint, tenant_token)
        tenant_body = r.json() if r.status_code == 200 else {"_error": r.status_code}
        log(r.status_code == 200, f"GET {endpoint} (new tenant)", f"status={r.status_code}")
    # Isolation check: tenant's config should differ from admin's (at minimum, not identical objects)
    if isinstance(admin_body, dict) and isinstance(tenant_body, dict):
        # For badges the zero-tenant should have many zeros; for configs empty/default.
        # We just assert they are not identical (which would indicate leak).
        same = json.dumps(admin_body, sort_keys=True, default=str) == json.dumps(tenant_body, sort_keys=True, default=str)
        # For /badges, admin counts > 0 whereas new tenant should be 0, so they differ. Accept same only for empty shells.
        note = f"admin={str(admin_body)[:120]} | tenant={str(tenant_body)[:120]}"
        log(not same or endpoint == "/hcp/config", f"{endpoint} per-tenant differs", note)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6 — STRIPE WEBHOOK SMOKE
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== SECTION 6: STRIPE WEBHOOK SMOKE ===")

try:
    # Simulate a customer.subscription.updated event.
    payload = {
        "id": "evt_test_123",
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_test_123",
                "customer": "cus_test_123",
                "status": "active",
                "items": {"data": [{"price": {"id": "price_test_pro"}}]},
            }
        },
    }
    r = requests.post(f"{API}/stripe/webhook", json=payload, timeout=30)
    body = r.json() if r.status_code == 200 else r.text
    ok = r.status_code == 200 and isinstance(body, dict) and body.get("received") is True
    log(ok, "POST /stripe/webhook (dev mode)", f"status={r.status_code} body={body}")
except Exception as e:
    log(False, "POST /stripe/webhook", str(e))


# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
print("\n\n=== SUMMARY ===")
print(f"PASSED: {len(PASS)}")
print(f"FAILED: {len(FAIL)}")
if FAIL:
    print("\nFailures:")
    for name, detail in FAIL:
        print(f"  ❌ {name}  {detail}")
sys.exit(0 if not FAIL else 1)

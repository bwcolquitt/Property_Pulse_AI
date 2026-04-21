"""
Multi-Tenant SaaS Phase A — Backend Test
Tests: /api/tenants/* and /api/platform/*
"""
import os
import time
import json
import base64
import requests
from datetime import datetime, timezone

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://property-pulse-207.preview.emergentagent.com").rstrip("/")
API = BASE + "/api"

results = []
def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    results.append({"name": name, "ok": ok, "detail": detail})
    print(f"[{status}] {name} :: {detail}")

def bearer(tok):
    return {"Authorization": f"Bearer {tok}"}

# --- 1. Plans listing (public) ---
r = requests.get(f"{API}/tenants/plans", timeout=15)
try:
    plans = r.json()
except Exception:
    plans = []
expected = {"starter": 29, "pro": 79, "enterprise": 199}
ok = r.status_code == 200 and isinstance(plans, list) and len(plans) == 3
caps_ok = True
price_map = {}
if ok:
    for p in plans:
        for k in ("id", "name", "price", "properties_cap", "users_cap", "price_id"):
            if k not in p:
                caps_ok = False
        price_map[p["id"]] = p["price"]
    for pid, price in expected.items():
        if price_map.get(pid) != price:
            caps_ok = False
log("GET /api/tenants/plans returns 3 plans with correct fields & prices",
    ok and caps_ok, f"status={r.status_code}, ids={list(price_map.keys())}, prices={price_map}")

# --- 2. Self-signup flow ---
ts = int(time.time())
signup_email = f"test-signup-{ts}@example.com"
signup_body = {
    "company_name": "Test Acme Rentals",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": signup_email,
    "password": "SecurePass123",
    "phone": "+15551234567",
    "plan": "pro",
}
r = requests.post(f"{API}/tenants/signup", json=signup_body, timeout=15)
signup_data = {}
try:
    signup_data = r.json()
except Exception:
    pass
ok = (r.status_code == 200 and signup_data.get("success") is True
      and signup_data.get("plan") == "pro"
      and signup_data.get("tenant_id") and signup_data.get("tenant_slug")
      and signup_data.get("user_id") and signup_data.get("trial_ends_at")
      and signup_data.get("token"))
log("POST /api/tenants/signup returns tenant_id/slug/user_id/trial_ends_at/plan/token",
    ok, f"status={r.status_code}, keys={list(signup_data.keys())}")

tenant_token = signup_data.get("token", "")
new_tenant_id = signup_data.get("tenant_id", "")

# trial_ends_at ~14 days
trial_ok = False
try:
    ends = datetime.fromisoformat(signup_data["trial_ends_at"].replace("Z", "+00:00"))
    delta_days = (ends - datetime.now(timezone.utc)).total_seconds() / 86400
    trial_ok = 13.5 < delta_days < 14.5
    log("trial_ends_at is ~14 days in the future", trial_ok, f"delta_days={delta_days:.2f}")
except Exception as e:
    log("trial_ends_at parse", False, str(e))

# GET /api/tenants/me with new token
r = requests.get(f"{API}/tenants/me", headers=bearer(tenant_token), timeout=15)
me_t = {}
try:
    me_t = r.json()
except Exception:
    pass
ok = (r.status_code == 200
      and me_t.get("plan") == "pro"
      and me_t.get("status") == "trialing"
      and me_t.get("is_in_trial") is True
      and 13 <= me_t.get("trial_days_left", -1) <= 14)
log("GET /api/tenants/me → plan=pro, status=trialing, is_in_trial=true, trial_days_left≈14",
    ok, f"plan={me_t.get('plan')}, status={me_t.get('status')}, in_trial={me_t.get('is_in_trial')}, days_left={me_t.get('trial_days_left')}")

# GET /api/auth/me with new token
r = requests.get(f"{API}/auth/me", headers=bearer(tenant_token), timeout=15)
user_me = {}
try:
    user_me = r.json()
except Exception:
    pass
ok = (r.status_code == 200 and user_me.get("tenant_id") == new_tenant_id
      and user_me.get("email") == signup_email)
log("GET /api/auth/me with signup token → tenant_id matches, email matches",
    ok, f"status={r.status_code}, tenant_id={user_me.get('tenant_id')}, email={user_me.get('email')}")

# Duplicate signup
r = requests.post(f"{API}/tenants/signup", json=signup_body, timeout=15)
ok = r.status_code == 400 and "already registered" in r.text.lower()
log("Duplicate signup returns 400 'Email already registered'",
    ok, f"status={r.status_code}, body={r.text[:200]}")

# --- 3. Platform admin endpoints ---
r = requests.post(f"{API}/auth/login", json={"email": "admin@example.com", "password": "admin123"}, timeout=15)
admin_login = {}
try:
    admin_login = r.json()
except Exception:
    pass
admin_token = admin_login.get("token") or admin_login.get("access_token") or ""
ok = r.status_code == 200 and admin_token != ""
log("Admin login returns 200 + token", ok,
    f"status={r.status_code}, keys={list(admin_login.keys())}")

# Regression: admin /auth/me returns tenant_id
r = requests.get(f"{API}/auth/me", headers=bearer(admin_token), timeout=15)
admin_me = {}
try:
    admin_me = r.json()
except Exception:
    pass
ok = r.status_code == 200 and "tenant_id" in admin_me
log("Regression: admin /api/auth/me returns user with tenant_id",
    ok, f"tenant_id={admin_me.get('tenant_id')}, is_platform_admin={admin_me.get('is_platform_admin')}")

# GET /api/platform/tenants
r = requests.get(f"{API}/platform/tenants", headers=bearer(admin_token), timeout=15)
plat_tenants = []
try:
    plat_tenants = r.json()
except Exception:
    pass
ok = (r.status_code == 200 and isinstance(plat_tenants, list) and len(plat_tenants) >= 2)
have_default = any(t.get("tenant_id") == "default" for t in plat_tenants) if isinstance(plat_tenants, list) else False
have_new = any(t.get("tenant_id") == new_tenant_id for t in plat_tenants) if isinstance(plat_tenants, list) else False
counts_ok = all(("user_count" in t and "property_count" in t) for t in plat_tenants) if isinstance(plat_tenants, list) else False
log("GET /api/platform/tenants ≥2 incl. default + new signup, each with user_count/property_count",
    ok and have_default and have_new and counts_ok,
    f"status={r.status_code}, count={len(plat_tenants) if isinstance(plat_tenants, list) else 'N/A'}, have_default={have_default}, have_new={have_new}, counts_ok={counts_ok}")

# GET /api/platform/stats
r = requests.get(f"{API}/platform/stats", headers=bearer(admin_token), timeout=15)
stats = {}
try:
    stats = r.json()
except Exception:
    pass
required_keys = {"total_tenants", "active", "trialing", "cancelled", "by_plan", "mrr"}
ok = r.status_code == 200 and required_keys.issubset(set(stats.keys()))
by_plan = stats.get("by_plan", {}) if isinstance(stats, dict) else {}
prices = {"starter": 29, "pro": 79, "enterprise": 199}
expected_mrr = sum(by_plan.get(p, 0) * prices[p] for p in prices)
mrr_ok = stats.get("mrr") == expected_mrr
log("GET /api/platform/stats has all keys + MRR = sum(count*price)",
    ok and mrr_ok,
    f"status={r.status_code}, stats={stats}, expected_mrr={expected_mrr}")

# POST /api/platform/tenants (manual create)
manual_email = f"manual-admin-{ts}@example.com"
manual_body = {
    "company_name": "Manual Tenant Co",
    "admin_email": manual_email,
    "admin_first_name": "Alice",
    "admin_last_name": "Smith",
    "admin_password": "Password1",
    "plan": "enterprise",
    "skip_trial": True,
}
r = requests.post(f"{API}/platform/tenants", json=manual_body,
                  headers=bearer(admin_token), timeout=15)
created = {}
try:
    created = r.json()
except Exception:
    pass
ok = (r.status_code == 200 and created.get("success") is True
      and created.get("tenant_id") and created.get("tenant_slug") and created.get("user_id"))
log("POST /api/platform/tenants (skip_trial=true, enterprise) returns success",
    ok, f"status={r.status_code}, body={created}")
manual_tid = created.get("tenant_id", "")

# Verify tenant appears with plan=enterprise, status=active
r = requests.get(f"{API}/platform/tenants", headers=bearer(admin_token), timeout=15)
all_ts = r.json() if r.ok else []
found = next((t for t in all_ts if t.get("tenant_id") == manual_tid), None) if isinstance(all_ts, list) else None
ok = bool(found) and found.get("plan") == "enterprise" and found.get("status") == "active"
log("New manual tenant shows plan=enterprise, status=active",
    bool(ok), f"found={bool(found)}, plan={(found or {}).get('plan')}, status={(found or {}).get('status')}")

# Deactivate
r = requests.post(f"{API}/platform/tenants/{manual_tid}/deactivate",
                  headers=bearer(admin_token), timeout=15)
ok = r.status_code == 200
r2 = requests.get(f"{API}/platform/tenants", headers=bearer(admin_token), timeout=15)
all_ts = r2.json() if r2.ok else []
found = next((t for t in all_ts if t.get("tenant_id") == manual_tid), None) if isinstance(all_ts, list) else None
ok2 = bool(found) and found.get("active") is False and found.get("status") == "suspended"
log("POST /api/platform/tenants/{id}/deactivate → active=false, status=suspended",
    ok and ok2, f"deactivate={r.status_code}, active={(found or {}).get('active')}, status={(found or {}).get('status')}")

# Activate
r = requests.post(f"{API}/platform/tenants/{manual_tid}/activate",
                  headers=bearer(admin_token), timeout=15)
ok = r.status_code == 200
r2 = requests.get(f"{API}/platform/tenants", headers=bearer(admin_token), timeout=15)
all_ts = r2.json() if r2.ok else []
found = next((t for t in all_ts if t.get("tenant_id") == manual_tid), None) if isinstance(all_ts, list) else None
ok2 = bool(found) and found.get("status") == "active"
log("POST /api/platform/tenants/{id}/activate → status=active",
    ok and ok2, f"activate={r.status_code}, status={(found or {}).get('status')}")

# Impersonate
r = requests.post(f"{API}/platform/impersonate", json={"tenant_id": manual_tid},
                  headers=bearer(admin_token), timeout=15)
imp = {}
try:
    imp = r.json()
except Exception:
    pass
set_cookie = r.headers.get("set-cookie", "") or ""
cookie_ok = "access_token=" in set_cookie and ("Max-Age=3600" in set_cookie or "max-age=3600" in set_cookie.lower())
ok = r.status_code == 200 and imp.get("success") is True and bool(imp.get("token"))
log("POST /api/platform/impersonate returns success + new JWT + cookie Max-Age=3600",
    ok and cookie_ok,
    f"status={r.status_code}, has_token={bool(imp.get('token'))}, cookie_ok={cookie_ok}, set_cookie={set_cookie[:200] if set_cookie else 'none'}")

# --- 4. Platform admin authorization (non-admin is 403) ---
r = requests.get(f"{API}/platform/tenants", headers=bearer(tenant_token), timeout=15)
ok = r.status_code == 403
log("Non-platform-admin GET /api/platform/tenants → 403",
    ok, f"status={r.status_code}, body={r.text[:200]}")

# --- 5. Tenant actions by tenant admin ---
r = requests.post(f"{API}/tenants/upgrade", json={"plan": "enterprise"},
                  headers=bearer(tenant_token), timeout=15)
ok = r.status_code == 200
log("POST /api/tenants/upgrade {plan:'enterprise'} → 200",
    ok, f"status={r.status_code}, body={r.text[:200]}")

r = requests.get(f"{API}/tenants/me", headers=bearer(tenant_token), timeout=15)
me_t = r.json() if r.ok else {}
ok = me_t.get("plan") == "enterprise"
log("GET /api/tenants/me shows plan=enterprise after upgrade",
    ok, f"plan={me_t.get('plan')}")

r = requests.post(f"{API}/tenants/cancel", headers=bearer(tenant_token), timeout=15)
body = {}
try:
    body = r.json()
except Exception:
    pass
ok = r.status_code == 200 and body.get("success") is True
log("POST /api/tenants/cancel → 200 success message",
    ok, f"status={r.status_code}, body={body}")

r = requests.get(f"{API}/tenants/me", headers=bearer(tenant_token), timeout=15)
me_t = r.json() if r.ok else {}
ok = me_t.get("status") == "cancelling"
log("GET /api/tenants/me after cancel → status=cancelling",
    ok, f"status={me_t.get('status')}")

# --- 6. JWT tenant_id embedded ---
def b64url_decode(s):
    s = s + "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s.encode("ascii"))
try:
    parts = tenant_token.split(".")
    payload = json.loads(b64url_decode(parts[1]))
except Exception:
    payload = {}
ok = ("tenant_id" in payload and "is_platform_admin" in payload
      and payload.get("tenant_id") == new_tenant_id)
log("Signup JWT payload includes tenant_id + is_platform_admin",
    ok, f"payload keys={list(payload.keys())}, tenant_id={payload.get('tenant_id')}, is_platform_admin={payload.get('is_platform_admin')}")

# --- Summary ---
print("\n" + "=" * 70)
total = len(results)
passed = sum(1 for r in results if r["ok"])
print(f"TOTAL: {passed}/{total} passed")
for r in results:
    if not r["ok"]:
        print(f"  FAIL -> {r['name']} :: {r['detail']}")

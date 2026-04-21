"""
Backend integration tests for Property Pulse AI - NEW APIs.

Tests 5 new task groups:
 1. Host Inbox / Guest Messages (routes/guest_messages.py)
 2. Owners Inventory (routes/owners_inventory.py)
 3. SMS Delivery (routes/sms.py)
 4. PMS Integrations (routes/pms_integrations.py)
 5. Guest Portal updates (routes/guest_portal.py) - my-stay, checkout auto-turnover
"""
import os
import sys
import json
import requests
from datetime import datetime

BASE = "https://property-pulse-207.preview.emergentagent.com"
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"

results = []


def record(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append((name, passed, detail))
    print(f"[{status}] {name} :: {detail[:500]}")


def jprint(obj):
    try:
        return json.dumps(obj, indent=2)[:1500]
    except Exception:
        return str(obj)[:1500]


# ---------- Login as admin ----------
def login():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30, verify=True)
    r.raise_for_status()
    j = r.json()
    return j["token"], j


admin_token, admin_user = login()
ADMIN_HEADERS = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
print(f"Admin logged in: {admin_user['email']} ({admin_user.get('role')})")


# Helper: request with admin auth
def A(method, path, **kw):
    hdr = dict(ADMIN_HEADERS)
    hdr.update(kw.pop("headers", {}) or {})
    return requests.request(method, f"{API}{path}", headers=hdr, timeout=30, **kw)


def G(method, path, token, **kw):
    hdr = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    hdr.update(kw.pop("headers", {}) or {})
    return requests.request(method, f"{API}{path}", headers=hdr, timeout=30, **kw)


# ---------- Setup: get an existing property & reservation ----------
props_r = A("GET", "/properties")
props = props_r.json() if props_r.ok else []
property_id = props[0]["id"] if props else ""
print(f"Found {len(props)} properties. Using property_id={property_id}")

resv_r = A("GET", "/reservations")
reservations = resv_r.json() if resv_r.ok else []
reservation_id = ""
for r in reservations:
    if r.get("id"):
        reservation_id = r["id"]
        break
print(f"Found {len(reservations)} reservations. Using reservation_id={reservation_id}")


# =========================================================
# 1. HOST INBOX / GUEST MESSAGES
# =========================================================
print("\n========== 1. HOST INBOX / GUEST MESSAGES ==========")

# Count issues before
issues_before_r = A("GET", "/issues")
issues_before = len(issues_before_r.json()) if issues_before_r.ok else 0
print(f"issues before: {issues_before}")

msg_payload = {
    "property_id": property_id,
    "reservation_id": reservation_id,
    "category": "problem",
    "subject": "Hot tub not heating up",
    "body": "Hi! Just wanted to flag that the hot tub seems to be stuck at 80F - is this normal?",
    "photos": [],
}
r = A("POST", "/guest-messages", json=msg_payload)
if r.ok and r.json().get("success"):
    guest_msg_id = r.json().get("id")
    record("POST /api/guest-messages", True, f"id={guest_msg_id}")
else:
    guest_msg_id = None
    record("POST /api/guest-messages", False, f"{r.status_code} {r.text[:300]}")

# Verify NO new issue created
issues_after_r = A("GET", "/issues")
issues_after = len(issues_after_r.json()) if issues_after_r.ok else 0
record(
    "Creating guest message does NOT create an issue directly",
    issues_after == issues_before,
    f"issues before={issues_before}, after={issues_after}",
)

# GET /api/guest-messages (host list)
r = A("GET", "/guest-messages")
if r.ok and isinstance(r.json(), list):
    lst = r.json()
    record("GET /api/guest-messages (list)", True, f"count={len(lst)}")
else:
    record("GET /api/guest-messages (list)", False, f"{r.status_code} {r.text[:300]}")

r = A("GET", "/guest-messages?status=new")
record("GET /api/guest-messages?status=new", r.ok, f"count={len(r.json()) if r.ok else r.text[:200]}")

if property_id:
    r = A("GET", f"/guest-messages?property_id={property_id}")
    record(f"GET /api/guest-messages?property_id filter", r.ok, f"count={len(r.json()) if r.ok else r.text[:200]}")

r = A("GET", "/guest-messages/stats")
if r.ok:
    s = r.json()
    required = {"new", "replied", "converted", "resolved", "total"}
    record("GET /api/guest-messages/stats", required.issubset(s.keys()), f"stats={s}")
else:
    record("GET /api/guest-messages/stats", False, f"{r.status_code} {r.text[:300]}")

# Reply flow
if guest_msg_id:
    r2 = A("POST", "/guest-messages", json={**msg_payload, "subject": "Reply test message"})
    reply_msg_id = r2.json().get("id") if r2.ok else guest_msg_id
    r = A("PUT", f"/guest-messages/{reply_msg_id}/reply", json={"reply": "Thanks! We'll look into the hot tub right away."})
    record("PUT /api/guest-messages/{id}/reply", r.ok and r.json().get("success"), f"{r.status_code} {r.text[:200]}")
    r = A("GET", "/guest-messages")
    replied = next((m for m in r.json() if m.get("id") == reply_msg_id), None)
    record(
        "Reply transitions status to 'replied'",
        bool(replied) and replied.get("status") == "replied",
        f"status={replied.get('status') if replied else 'not found'}",
    )

# Convert-to-issue flow
if guest_msg_id:
    r = A("PUT", f"/guest-messages/{guest_msg_id}/convert-to-issue",
          json={"trade_type": "plumbing", "priority": "high", "notes": "Check hot tub heater"})
    if r.ok and r.json().get("success"):
        new_issue_id = r.json().get("issue_id")
        record("PUT /api/guest-messages/{id}/convert-to-issue", True, f"issue_id={new_issue_id}")
        issues_now_r = A("GET", "/issues")
        issues_now = len(issues_now_r.json()) if issues_now_r.ok else 0
        record(
            "Convert-to-issue creates a real issue",
            issues_now > issues_before,
            f"issues before={issues_before}, now={issues_now}",
        )
        lst = A("GET", "/guest-messages").json()
        conv = next((m for m in lst if m.get("id") == guest_msg_id), None)
        record(
            "Convert sets message status='converted' and stores converted_issue_id",
            bool(conv) and conv.get("status") == "converted" and conv.get("converted_issue_id"),
            f"status={conv.get('status') if conv else 'missing'}, issue={conv.get('converted_issue_id') if conv else ''}",
        )
    else:
        record("PUT /api/guest-messages/{id}/convert-to-issue", False, f"{r.status_code} {r.text[:300]}")

# Resolve flow
resolve_r = A("POST", "/guest-messages", json={**msg_payload, "subject": "Resolve test"})
resolve_id = resolve_r.json().get("id") if resolve_r.ok else None
if resolve_id:
    r = A("PUT", f"/guest-messages/{resolve_id}/resolve")
    record("PUT /api/guest-messages/{id}/resolve", r.ok and r.json().get("success"), f"{r.status_code} {r.text[:200]}")
    lst = A("GET", "/guest-messages").json()
    res_msg = next((m for m in lst if m.get("id") == resolve_id), None)
    record(
        "Resolve sets status='resolved'",
        bool(res_msg) and res_msg.get("status") == "resolved",
        f"status={res_msg.get('status') if res_msg else 'missing'}",
    )

# Thread
if reservation_id:
    r = A("GET", f"/guest-messages/thread/{reservation_id}")
    record("GET /api/guest-messages/thread/{reservation_id}", r.ok, f"count={len(r.json()) if r.ok else r.text[:200]}")


# =========================================================
# 2. OWNERS INVENTORY
# =========================================================
print("\n========== 2. OWNERS INVENTORY ==========")

box_payload = {
    "property_id": property_id,
    "label": "Beach Gear Storage",
    "location": "Garage Shelf 2",
    "access_notes": "Key under the ceramic frog by back door",
    "owner_only": True,
    "contents": ["Beach chairs x4", "Boogie boards x2", "Umbrella"],
    "photo_url": "",
}
r = A("POST", "/owners-inventory", json=box_payload)
if r.ok and r.json().get("success"):
    box_id = r.json().get("id")
    qr_code = r.json().get("qr_code")
    qr_ok = isinstance(qr_code, str) and qr_code.startswith("OWN-")
    record("POST /api/owners-inventory (QR auto-generated)", qr_ok, f"id={box_id} qr_code={qr_code}")
else:
    box_id = None; qr_code = None
    record("POST /api/owners-inventory", False, f"{r.status_code} {r.text[:300]}")

r = A("GET", "/owners-inventory")
if r.ok:
    lst = r.json()
    has_prop_name = any("property_name" in b for b in lst) if lst else True
    record("GET /api/owners-inventory (list + enrichment)", True,
           f"count={len(lst)}, any has property_name={has_prop_name}")
else:
    record("GET /api/owners-inventory (list)", False, f"{r.status_code} {r.text[:200]}")

if property_id:
    r = A("GET", f"/owners-inventory?property_id={property_id}")
    record("GET /api/owners-inventory?property_id filter", r.ok, f"count={len(r.json()) if r.ok else r.text[:200]}")

if qr_code:
    r = A("GET", f"/owners-inventory/qr/{qr_code}")
    record("GET /api/owners-inventory/qr/{qr_code}",
           r.ok and r.json().get("label") == box_payload["label"],
           f"{r.status_code} label={r.json().get('label') if r.ok else ''}")

if box_id:
    r = A("PUT", f"/owners-inventory/{box_id}", json={"label": "Beach Gear Storage (Updated)", "contents": ["Beach chairs x6"]})
    record("PUT /api/owners-inventory/{id}", r.ok and r.json().get("success"), f"{r.status_code}")

if box_id:
    r = A("DELETE", f"/owners-inventory/{box_id}")
    record("DELETE /api/owners-inventory/{id} (soft)", r.ok and r.json().get("success"), f"{r.status_code}")
    lst = A("GET", "/owners-inventory").json()
    still_there = any(b.get("id") == box_id for b in lst)
    record("Soft delete removes box from active list", not still_there, f"still listed={still_there}")


# =========================================================
# 3. SMS DELIVERY
# =========================================================
print("\n========== 3. SMS DELIVERY ==========")

r = A("GET", "/sms/providers")
if r.ok:
    provs = r.json()
    ids = {p.get("id") for p in provs}
    expected = {"quo", "twilio", "messagebird", "custom_api", "disabled"}
    record("GET /api/sms/providers (5 providers)",
           expected.issubset(ids) and len(provs) >= 5, f"ids={ids}")
else:
    record("GET /api/sms/providers", False, f"{r.status_code} {r.text[:200]}")

r = A("GET", "/sms/config")
record("GET /api/sms/config (initial)", r.ok, f"{r.status_code} cfg={jprint(r.json()) if r.ok else r.text[:200]}")

cfg_payload = {
    "provider": "quo",
    "api_key": "test_key_abcdefgh12345678",
    "from_number": "+15551234567",
    "enabled": True,
}
r = A("PUT", "/sms/config", json=cfg_payload)
record("PUT /api/sms/config (set quo)", r.ok and r.json().get("success"), f"{r.status_code} {r.text[:200]}")

r = A("GET", "/sms/config")
if r.ok:
    cfg = r.json()
    masked_ok = "api_key_masked" in cfg and "api_key" not in cfg
    record(
        "GET /api/sms/config (secrets masked)",
        masked_ok and cfg.get("provider") == "quo" and cfg.get("from_number") == "+15551234567",
        f"provider={cfg.get('provider')} from_number={cfg.get('from_number')} api_key_masked={cfg.get('api_key_masked')} raw_api_key_present={'api_key' in cfg}",
    )
else:
    record("GET /api/sms/config (masked)", False, r.text[:200])

# POST /sms/send with fake api_key
r = A("POST", "/sms/send", json={"to": "+15555555555", "body": "test"})
if r.ok:
    j = r.json()
    ok = ("success" in j)
    record("POST /api/sms/send (fake key -> graceful)", ok, f"{jprint(j)}")
else:
    record("POST /api/sms/send", False, f"{r.status_code} {r.text[:300]}")

# Disable & send -> simulated:true
r = A("PUT", "/sms/config", json={"provider": "disabled", "enabled": False, "from_number": "+15551234567"})
record("PUT /api/sms/config (disable)", r.ok, f"{r.status_code}")
r = A("POST", "/sms/send", json={"to": "+15555555555", "body": "test"})
if r.ok:
    j = r.json()
    record("POST /api/sms/send (disabled -> simulated:true)", j.get("simulated") is True, f"{jprint(j)}")
else:
    record("POST /api/sms/send (disabled)", False, f"{r.status_code} {r.text[:200]}")

r = A("GET", "/sms/logs")
if r.ok:
    logs = r.json()
    record("GET /api/sms/logs", isinstance(logs, list) and len(logs) >= 1,
           f"count={len(logs)} first_status={logs[0].get('status') if logs else None}")
else:
    record("GET /api/sms/logs", False, f"{r.status_code} {r.text[:200]}")


# =========================================================
# 4. PMS INTEGRATIONS
# =========================================================
print("\n========== 4. PMS INTEGRATIONS ==========")

r = A("GET", "/pms/providers")
if r.ok:
    provs = r.json()
    ids = {p.get("id") for p in provs}
    expected = {"hostaway", "lodgify", "hospitable", "ownerrez"}
    field_metadata_ok = all("fields" in p for p in provs)
    record("GET /api/pms/providers (4 providers w/ fields)",
           expected.issubset(ids) and field_metadata_ok, f"ids={ids}")
else:
    record("GET /api/pms/providers", False, r.text[:200])

r = A("GET", "/pms/connections")
initial_count = len(r.json()) if r.ok else 0
record("GET /api/pms/connections (initial)", r.ok, f"count={initial_count}")

r = A("POST", "/pms/connect", json={"provider": "hostaway", "account_id": "test_account", "api_key": "secretkey12345"})
record("POST /api/pms/connect hostaway", r.ok and r.json().get("success"), f"{r.status_code} {r.text[:200]}")

r = A("GET", "/pms/connections")
if r.ok:
    conns = r.json()
    hostaway = next((c for c in conns if c.get("provider") == "hostaway"), None)
    has_mask = bool(hostaway and hostaway.get("api_key_masked"))
    no_raw = hostaway and "api_key" not in hostaway
    record("GET /api/pms/connections (secrets masked)",
           has_mask and no_raw,
           f"api_key_masked={hostaway.get('api_key_masked') if hostaway else None} raw_api_key_present={'api_key' in (hostaway or {})}")
else:
    record("GET /api/pms/connections (post-connect)", False, r.text[:200])

resv_before_r = A("GET", "/reservations")
resv_before = len(resv_before_r.json()) if resv_before_r.ok else 0
r = A("POST", "/pms/sync/hostaway")
if r.ok:
    j = r.json()
    sync_ok = j.get("success") and j.get("synced") == 5
    record("POST /api/pms/sync/hostaway (5 stubbed)", sync_ok, f"{jprint(j)}")
    resv_after_r = A("GET", "/reservations")
    resv_after = resv_after_r.json() if resv_after_r.ok else []
    tagged = [x for x in resv_after if x.get("source_platform") == "hostaway"]
    record("Sync creates reservations with source_platform=hostaway",
           len(tagged) >= 5,
           f"tagged count={len(tagged)}, reservations before={resv_before}, after={len(resv_after)}")
else:
    record("POST /api/pms/sync/hostaway", False, f"{r.status_code} {r.text[:300]}")

r = A("DELETE", "/pms/connect/hostaway")
record("DELETE /api/pms/connect/hostaway", r.ok and r.json().get("success"), f"{r.status_code}")
r = A("GET", "/pms/connections")
conns = r.json() if r.ok else []
still = any(c.get("provider") == "hostaway" for c in conns)
record("Disconnect removes hostaway from connections", not still, f"still_present={still}")


# =========================================================
# 5. GUEST PORTAL UPDATES
# =========================================================
print("\n========== 5. GUEST PORTAL UPDATES ==========")

if not reservations:
    record("Guest portal prerequisite", False, "No existing reservation")
else:
    valid_res = next((rr for rr in reservations if rr.get("property_id")), reservations[0])
    res_id = valid_res.get("id")

    r = A("POST", "/guest-portal/send-link", json={"reservation_id": res_id, "guest_email": "testguest@example.com"})
    if r.ok and r.json().get("token"):
        magic_token = r.json()["token"]
        record("POST /api/guest-portal/send-link", True, "token acquired")
    else:
        magic_token = None
        record("POST /api/guest-portal/send-link", False, f"{r.status_code} {r.text[:300]}")

    if magic_token:
        r = requests.post(f"{API}/guest-portal/access", json={"token": magic_token}, timeout=30)
        if r.ok and r.json().get("token"):
            guest_jwt = r.json()["token"]
            record("POST /api/guest-portal/access", True, f"guest role={r.json().get('role')}")
        else:
            guest_jwt = None
            record("POST /api/guest-portal/access", False, f"{r.status_code} {r.text[:300]}")

        if guest_jwt:
            r = G("GET", "/guest-portal/my-stay", guest_jwt)
            if r.ok:
                j = r.json()
                prop = j.get("property") or {}
                keys = ["city", "state", "zip", "lat", "lng"]
                has_keys = all(k in prop for k in keys)
                record("GET /api/guest-portal/my-stay returns property city/state/zip/lat/lng",
                       has_keys, f"property keys={list(prop.keys())}")
            else:
                record("GET /api/guest-portal/my-stay", False, f"{r.status_code} {r.text[:300]}")

            tov_before = A("GET", "/turnovers")
            tov_before_count = len(tov_before.json()) if tov_before.ok else 0
            r = G("POST", "/guest-portal/checkout", guest_jwt,
                  json={"reservation_id": res_id, "feedback": "Great stay!", "rating": 5, "departure_checklist_completed": True})
            if r.ok and r.json().get("success"):
                record("POST /api/guest-portal/checkout", True, f"{r.json().get('message')}")
                tov_after = A("GET", "/turnovers")
                tov_list = tov_after.json() if tov_after.ok else []
                auto_matches = [
                    t for t in tov_list
                    if t.get("auto_generated") is True
                    or "Checkout Cleaning" in (t.get("title") or "")
                    or t.get("reservation_id") == res_id
                ]
                record(
                    "Checkout auto-creates turnover (auto_generated/Checkout Cleaning)",
                    len(auto_matches) >= 1,
                    f"turnovers before={tov_before_count}, after={len(tov_list)}, auto_matches={len(auto_matches)}",
                )
            else:
                record("POST /api/guest-portal/checkout", False, f"{r.status_code} {r.text[:300]}")


# ==================
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
passed = sum(1 for _, p, _ in results if p)
total = len(results)
for name, p, d in results:
    print(f"[{'PASS' if p else 'FAIL'}] {name}")
print(f"\n{passed}/{total} passed ({100*passed/total:.1f}%)")

sys.exit(0 if passed == total else 1)

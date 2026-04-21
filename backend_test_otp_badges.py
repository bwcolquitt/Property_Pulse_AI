"""Backend tests for Guest OTP and Dashboard Badges APIs."""
import os
import sys
import requests
import time

BASE = "https://property-pulse-207.preview.emergentagent.com/api"
EMAIL = "admin@example.com"
PASSWORD = "admin123"

results = []

def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}  {detail}")
    results.append((name, ok, detail))

def login():
    r = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]

def main():
    token = login()
    h = {"Authorization": f"Bearer {token}"}
    print(f"Logged in. Token prefix: {token[:20]}")

    phone = "+15551234567"

    # ---- Guest OTP Tests ----
    # 1. Send OTP
    r = requests.post(f"{BASE}/guest-otp/send", json={"phone": phone}, headers=h, timeout=15)
    try:
        data = r.json()
    except Exception:
        data = {}
    ok = r.status_code == 200 and data.get("success") and data.get("simulated") and data.get("code") and len(str(data.get("code", ""))) == 6
    record("OTP send (simulated)", ok, f"status={r.status_code} body={data}")
    code = data.get("code", "") if ok else ""

    # 2. Verify with correct code
    if code:
        r = requests.post(f"{BASE}/guest-otp/verify", json={"phone": phone, "code": code}, headers=h, timeout=15)
        try:
            data2 = r.json()
        except Exception:
            data2 = {}
        record("OTP verify correct code", r.status_code == 200 and data2.get("success"), f"status={r.status_code} body={data2}")
    else:
        record("OTP verify correct code", False, "no code available")

    # 3. Verify with wrong code - need a NEW code since previous is verified
    r = requests.post(f"{BASE}/guest-otp/send", json={"phone": phone}, headers=h, timeout=15)
    try:
        data = r.json()
    except Exception:
        data = {}
    new_code = data.get("code", "")
    if new_code:
        r = requests.post(f"{BASE}/guest-otp/verify", json={"phone": phone, "code": "000000" if new_code != "000000" else "111111"}, headers=h, timeout=15)
        try:
            d = r.json()
        except Exception:
            d = {}
        ok = r.status_code == 400 and "Invalid" in (d.get("detail", "") or "")
        record("OTP verify wrong code returns 400", ok, f"status={r.status_code} body={d}")
    else:
        record("OTP verify wrong code returns 400", False, "could not send new code")

    # 4. Status check
    r = requests.get(f"{BASE}/guest-otp/status", headers=h, timeout=15)
    try:
        d = r.json()
    except Exception:
        d = {}
    ok = r.status_code == 200 and d.get("phone_verified") is True and d.get("phone") == phone
    record("OTP status returns phone_verified=true", ok, f"status={r.status_code} body={d}")

    # 5. Rate limit: send 4 quickly, 4th should 429
    # We've already sent 2 codes in this test, so do up to 2 more. Use a fresh phone.
    # Use unique phone per run to avoid rate-limit carryover
    phone2 = "+1555" + str(int(time.time()))[-7:]
    # Clean slate - attempt 4 consecutive sends
    status_codes = []
    last_body = None
    for i in range(4):
        r = requests.post(f"{BASE}/guest-otp/send", json={"phone": phone2}, headers=h, timeout=15)
        status_codes.append(r.status_code)
        try:
            last_body = r.json()
        except Exception:
            last_body = {}
    ok = status_codes[:3] == [200, 200, 200] and status_codes[3] == 429
    record("OTP rate limit 4th send returns 429", ok, f"statuses={status_codes} 4th_body={last_body}")

    # ---- Dashboard Badges Tests ----
    expected_keys = {"host_inbox_new", "outstanding_issues", "urgent_issues", "pending_turnovers", "unread_notifications", "low_inventory", "setup_incomplete"}
    r = requests.get(f"{BASE}/badges", headers=h, timeout=15)
    try:
        b0 = r.json()
    except Exception:
        b0 = {}
    missing = expected_keys - set(b0.keys())
    ok = r.status_code == 200 and not missing and all(isinstance(b0.get(k), int) and b0.get(k) >= 0 for k in expected_keys)
    record("Badges returns all 7 keys as int>=0", ok, f"status={r.status_code} keys_missing={missing} body={b0}")

    # Create a guest message
    # Need a property_id - fetch one
    r = requests.get(f"{BASE}/properties", headers=h, timeout=15)
    props = r.json() if r.status_code == 200 else []
    property_id = props[0].get("id", "") if props else ""

    msg_payload = {"subject": "Test badge message", "body": "Testing host_inbox_new increment", "category": "question", "property_id": property_id}
    r = requests.post(f"{BASE}/guest-messages", json=msg_payload, headers=h, timeout=15)
    msg_ok = r.status_code == 200 and (r.json().get("success") is True)
    record("Create guest message for badge test", msg_ok, f"status={r.status_code}")

    r = requests.get(f"{BASE}/badges", headers=h, timeout=15)
    b1 = r.json() if r.status_code == 200 else {}
    ok = b1.get("host_inbox_new", 0) > b0.get("host_inbox_new", 0)
    record("host_inbox_new incremented after guest message", ok, f"before={b0.get('host_inbox_new')} after={b1.get('host_inbox_new')}")

    # Create an urgent issue
    if property_id:
        issue_payload = {"property_id": property_id, "title": "URGENT: Badge test leak in master bathroom", "priority": "urgent", "trade_type": "plumbing"}
        r = requests.post(f"{BASE}/issues", json=issue_payload, headers=h, timeout=15)
        issue_ok = r.status_code == 200
        record("Create urgent issue for badge test", issue_ok, f"status={r.status_code}")

        r = requests.get(f"{BASE}/badges", headers=h, timeout=15)
        b2 = r.json() if r.status_code == 200 else {}
        urgent_up = b2.get("urgent_issues", 0) > b1.get("urgent_issues", 0)
        outstanding_up = b2.get("outstanding_issues", 0) > b1.get("outstanding_issues", 0)
        record("urgent_issues incremented after urgent issue", urgent_up, f"before={b1.get('urgent_issues')} after={b2.get('urgent_issues')}")
        record("outstanding_issues incremented after urgent issue", outstanding_up, f"before={b1.get('outstanding_issues')} after={b2.get('outstanding_issues')}")
    else:
        record("Create urgent issue for badge test", False, "no property_id available")

    # Summary
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\n==== {passed}/{total} checks passed ====")
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())

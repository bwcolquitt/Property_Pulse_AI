"""Backend test for Setup Wizard, Push Notifications, and Guest Messages (regression)."""
import requests
import json
import sys

BASE = "https://property-pulse-207.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASS = "admin123"

results = []

def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    results.append((name, ok, detail))
    print(f"[{status}] {name} {('- ' + detail) if detail else ''}")

def login():
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    r.raise_for_status()
    j = r.json()
    return j.get("access_token") or j.get("token")


def test_setup_wizard(headers):
    print("\n=== 1. Setup Wizard ===")
    r = requests.get(f"{BASE}/setup/status", headers=headers, timeout=15)
    log("GET /api/setup/status returns 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code != 200:
        print(r.text); return
    data = r.json()
    required_keys = ["steps", "total", "completed", "progress_pct", "required_done", "required_total", "setup_complete"]
    missing = [k for k in required_keys if k not in data]
    log("Response has all required top-level keys", not missing, f"missing={missing}")

    steps = data.get("steps", [])
    log("steps has 7 items", len(steps) == 7, f"got={len(steps)}")

    step_required = ["id", "title", "description", "complete", "action_label", "route", "priority"]
    step_ids = [s.get("id") for s in steps]
    expected_ids = ["brand", "email", "properties", "ical", "team", "sms", "reservations"]
    log("step IDs match expected", sorted(step_ids) == sorted(expected_ids), f"got={step_ids}")

    for s in steps:
        missing_f = [f for f in step_required if f not in s]
        log(f"step '{s.get('id')}' has all fields", not missing_f, f"missing={missing_f}")
        if "complete" in s:
            log(f"step '{s.get('id')}' complete is bool", isinstance(s["complete"], bool), f"type={type(s['complete']).__name__}")

    step_map = {s["id"]: s for s in steps}
    log("step 'sms' has optional=true", step_map.get("sms", {}).get("optional") is True)
    log("step 'reservations' has optional=true", step_map.get("reservations", {}).get("optional") is True)
    log("step 'properties' complete=true (seed)", step_map.get("properties", {}).get("complete") is True,
        f"count={step_map.get('properties',{}).get('count')}")
    log("step 'team' complete=true (seed)", step_map.get("team", {}).get("complete") is True,
        f"count={step_map.get('team',{}).get('count')}")
    log("required_total matches non-optional count", data["required_total"] == len([s for s in steps if not s.get("optional")]),
        f"required_total={data['required_total']}")
    log("progress_pct in 0..100", isinstance(data["progress_pct"], (int, float)) and 0 <= data["progress_pct"] <= 100,
        f"progress_pct={data['progress_pct']}")
    print(f"INFO: progress {data['progress_pct']}%, completed {data['completed']}/{data['total']}, required {data['required_done']}/{data['required_total']}, setup_complete={data['setup_complete']}")


def test_push(headers):
    print("\n=== 2. Push Notifications ===")
    token = "ExponentPushToken[test_abc123]"
    r = requests.post(f"{BASE}/push/register",
                      json={"token": token, "platform": "ios", "device_name": "Test Device"},
                      headers=headers, timeout=15)
    log("POST /push/register returns 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        log("register returns success=true", r.json().get("success") is True)

    r2 = requests.post(f"{BASE}/push/register",
                       json={"token": token, "platform": "ios", "device_name": "Test Device Renamed"},
                       headers=headers, timeout=15)
    log("POST /push/register (duplicate) returns 200", r2.status_code == 200)

    r3 = requests.post(f"{BASE}/push/send",
                       json={"role": "admin", "title": "Test", "body": "Body"},
                       headers=headers, timeout=20)
    log("POST /push/send returns 200", r3.status_code == 200, f"status={r3.status_code} body={r3.text[:200]}")
    if r3.status_code == 200:
        body = r3.json()
        print(f"INFO: send response: {json.dumps(body)[:400]}")
        log("send did not crash (has success key)", "success" in body)

    r4 = requests.delete(f"{BASE}/push/unregister", params={"token": token}, headers=headers, timeout=15)
    log("DELETE /push/unregister returns 200", r4.status_code == 200, f"status={r4.status_code}")
    if r4.status_code == 200:
        log("unregister returns success=true", r4.json().get("success") is True)

    r5 = requests.post(f"{BASE}/push/send",
                       json={"role": "admin", "title": "Test2", "body": "Body2"},
                       headers=headers, timeout=20)
    if r5.status_code == 200:
        b5 = r5.json()
        print(f"INFO: after unregister send response: {json.dumps(b5)[:400]}")
        log("after unregister, sent=0 OR 'No registered/valid' msg",
            b5.get("sent", 0) == 0 or "No registered" in b5.get("message", "") or "No valid" in b5.get("message", ""))


def test_guest_message_regression(headers):
    print("\n=== 3. Guest message create (regression) ===")
    payload = {
        "property_id": "",
        "reservation_id": "",
        "category": "question",
        "subject": "Pool heating question",
        "body": "Is the pool heater on during our stay?",
        "photos": []
    }
    r = requests.post(f"{BASE}/guest-messages", json=payload, headers=headers, timeout=20)
    log("POST /api/guest-messages returns 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        log("response has id", bool(body.get("id")), f"id={body.get('id')}")
        log("response has success=true", body.get("success") is True)


def main():
    try:
        tok = login()
    except Exception as e:
        print(f"LOGIN FAILED: {e}")
        sys.exit(1)
    headers = {"Authorization": f"Bearer {tok}"}
    test_setup_wizard(headers)
    test_push(headers)
    test_guest_message_regression(headers)

    print("\n=== SUMMARY ===")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"Total: {len(results)}  Pass: {passed}  Fail: {failed}")
    if failed:
        print("\nFAILED TESTS:")
        for n, ok, d in results:
            if not ok:
                print(f"  - {n} :: {d}")
        sys.exit(1)

if __name__ == "__main__":
    main()

"""Email Delivery - pluggable adapter similar to SMS.

Providers: SMTP (universal, works with Gmail/Outlook/etc.), SendGrid, Resend, Disabled.
Default for white-label SaaS: SMTP (no API key needed — just host's existing Gmail/Outlook creds).
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from helpers import get_current_user, serialize_doc
from datetime import datetime, timezone
import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/email", tags=["email"])

def get_db(request: Request):
    return request.app.state.db

PROVIDERS = [
    {"id": "smtp", "name": "SMTP (Gmail / Outlook / any mail server)", "website": "",
     "description": "Use any existing email account. Gmail needs an app password.",
     "fields": ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "from_email", "from_name"]},
    {"id": "sendgrid", "name": "SendGrid", "website": "https://sendgrid.com",
     "description": "Transactional email at scale with high deliverability.",
     "fields": ["api_key", "from_email", "from_name"]},
    {"id": "resend", "name": "Resend (recommended)", "website": "https://resend.com",
     "description": "Modern, developer-friendly email API with free tier.",
     "fields": ["api_key", "from_email", "from_name"]},
    {"id": "disabled", "name": "Disabled (simulate only)", "website": "", "description": "For testing. mailto: link is used instead.", "fields": []},
]

@router.get("/providers")
async def list_providers():
    return PROVIDERS

@router.get("/config")
async def get_config(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    config = await db.email_config.find_one({"tenant_id": user.get("tenant_id", "default")}) or {}
    for secret in ["api_key", "smtp_password"]:
        if config.get(secret):
            v = config[secret]
            config[secret + "_masked"] = (v[:3] + "****" + v[-3:]) if len(v) > 6 else "****"
            config.pop(secret, None)
    config.pop("_id", None)
    if not config:
        config = {"provider": "disabled", "enabled": False}
    return config

class EmailConfigInput(BaseModel):
    provider: str
    api_key: Optional[str] = ""
    smtp_host: Optional[str] = ""
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = ""
    smtp_password: Optional[str] = ""
    from_email: Optional[str] = ""
    from_name: Optional[str] = ""
    enabled: bool = True

@router.put("/config")
async def update_config(input: EmailConfigInput, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    updates = {k: v for k, v in input.dict(exclude_unset=True).items() if v not in (None, "")}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.email_config.update_one({"tenant_id": user.get("tenant_id", "default")}, {"$set": {**updates, "tenant_id": user.get("tenant_id", "default")}}, upsert=True)
    return {"success": True}

class SendEmailInput(BaseModel):
    to: str
    subject: str
    body: str
    html_body: Optional[str] = ""
    purpose: str = "general"
    reservation_id: Optional[str] = ""

@router.post("/send")
async def send_email(input: SendEmailInput, request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")

    config = await db.email_config.find_one({"tenant_id": user.get("tenant_id", "default")}) or {}
    provider = config.get("provider", "disabled")
    enabled = config.get("enabled", False)
    from_email = config.get("from_email", "")
    from_name = config.get("from_name", "Property Pulse")

    now = datetime.now(timezone.utc).isoformat()
    log_doc = {
        "to": input.to, "from_email": from_email, "subject": input.subject, "body": input.body[:500],
        "purpose": input.purpose, "provider": provider, "reservation_id": input.reservation_id,
        "sent_at": now, "status": "pending", "response": "",
    }

    if not enabled or provider == "disabled":
        log_doc["status"] = "simulated"
        log_doc["response"] = "Email provider disabled"
        await db.email_logs.insert_one(log_doc)
        return {"success": True, "simulated": True, "message": "Email simulated (provider disabled). Configure in Email Delivery settings."}

    try:
        if provider == "smtp":
            resp = _send_smtp(config, input.to, input.subject, input.body, input.html_body or "", from_name)
        elif provider == "sendgrid":
            resp = await _send_sendgrid(config, input.to, input.subject, input.body, input.html_body or "", from_name)
        elif provider == "resend":
            resp = await _send_resend(config, input.to, input.subject, input.body, input.html_body or "", from_name)
        else:
            resp = {"ok": False, "detail": "Unknown provider"}

        log_doc["status"] = "sent" if resp.get("ok") else "failed"
        log_doc["response"] = str(resp)[:500]
        await db.email_logs.insert_one(log_doc)
        return {"success": resp.get("ok", False), "message": resp.get("detail", "")}
    except Exception as e:
        log_doc["status"] = "error"
        log_doc["response"] = str(e)[:500]
        await db.email_logs.insert_one(log_doc)
        return {"success": False, "message": str(e)}

@router.get("/logs")
async def list_logs(request: Request, limit: int = 50):
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    logs = await db.email_logs.find({}).sort("sent_at", -1).to_list(limit)
    return [serialize_doc(l) for l in logs]

# ===== Adapters =====
def _send_smtp(config, to, subject, body, html_body, from_name):
    host = config.get("smtp_host"); port = config.get("smtp_port", 587); user = config.get("smtp_user"); pw = config.get("smtp_password"); from_email = config.get("from_email", user)
    if not (host and user and pw and from_email):
        return {"ok": False, "detail": "SMTP not fully configured"}
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
        msg["To"] = to
        msg.attach(MIMEText(body, "plain"))
        if html_body:
            msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(host, port, timeout=15) as s:
            s.starttls()
            s.login(user, pw)
            s.send_message(msg)
        return {"ok": True, "detail": "Sent via SMTP"}
    except Exception as e:
        return {"ok": False, "detail": f"SMTP error: {e}"}

async def _send_sendgrid(config, to, subject, body, html_body, from_name):
    api_key = config.get("api_key"); from_email = config.get("from_email")
    if not (api_key and from_email):
        return {"ok": False, "detail": "SendGrid not configured"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "personalizations": [{"to": [{"email": to}]}],
                    "from": {"email": from_email, "name": from_name or ""},
                    "subject": subject,
                    "content": [{"type": "text/plain", "value": body}] + ([{"type": "text/html", "value": html_body}] if html_body else []),
                },
            )
            if r.status_code in (200, 202):
                return {"ok": True, "detail": "Sent via SendGrid"}
            return {"ok": False, "detail": f"SendGrid: {r.status_code} {r.text[:200]}"}
    except Exception as e:
        return {"ok": False, "detail": f"SendGrid error: {e}"}

async def _send_resend(config, to, subject, body, html_body, from_name):
    api_key = config.get("api_key"); from_email = config.get("from_email")
    if not (api_key and from_email):
        return {"ok": False, "detail": "Resend not configured"}
    try:
        from_field = f"{from_name} <{from_email}>" if from_name else from_email
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"from": from_field, "to": to, "subject": subject, "text": body, **({"html": html_body} if html_body else {})},
            )
            if r.status_code in (200, 201, 202):
                return {"ok": True, "detail": "Sent via Resend"}
            return {"ok": False, "detail": f"Resend: {r.status_code} {r.text[:200]}"}
    except Exception as e:
        return {"ok": False, "detail": f"Resend error: {e}"}

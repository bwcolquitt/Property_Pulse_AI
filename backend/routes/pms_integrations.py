"""PMS Integrations - Hostaway, Lodgify, Hospitable, OwnerRez.

SaaS customers can connect their existing PMS account to sync reservations.
Stores credentials per-company. Actual sync is stubbed for now; adapters ready
to be implemented as real API calls when live credentials are provided.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pms", tags=["pms"])

def get_db(request: Request):
    return request.app.state.db

PROVIDERS = [
    {
        "id": "hostaway", "name": "Hostaway", "website": "https://hostaway.com",
        "description": "Popular multi-channel PMS with Airbnb/Vrbo/Booking sync.",
        "fields": [{"key": "account_id", "label": "Account ID", "type": "text"}, {"key": "api_key", "label": "API Key", "type": "password"}],
    },
    {
        "id": "lodgify", "name": "Lodgify", "website": "https://lodgify.com",
        "description": "PMS + direct booking website builder.",
        "fields": [{"key": "api_key", "label": "API Key", "type": "password"}],
    },
    {
        "id": "hospitable", "name": "Hospitable", "website": "https://hospitable.com",
        "description": "Automated guest messaging & channel management.",
        "fields": [{"key": "api_token", "label": "API Token", "type": "password"}],
    },
    {
        "id": "ownerrez", "name": "OwnerRez", "website": "https://ownerrez.com",
        "description": "Property management & vacation rental software.",
        "fields": [{"key": "username", "label": "Username", "type": "text"}, {"key": "api_token", "label": "API Token", "type": "password"}],
    },
]

@router.get("/providers")
async def list_providers():
    return PROVIDERS

@router.get("/connections")
async def list_connections(request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    conns = await db.pms_connections.find({}).to_list(100)
    out = []
    for c in conns:
        d = serialize_doc(c)
        # Mask secrets
        for sk in ["api_key", "api_token", "auth_token", "password"]:
            if d.get(sk):
                v = d[sk]
                d[sk + "_masked"] = (v[:3] + "****" + v[-3:]) if len(v) > 6 else "****"
                d.pop(sk, None)
        out.append(d)
    return out

class ConnectInput(BaseModel):
    provider: str
    account_id: Optional[str] = ""
    api_key: Optional[str] = ""
    api_token: Optional[str] = ""
    username: Optional[str] = ""
    enabled: bool = True

@router.post("/connect")
async def connect_pms(input: ConnectInput, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    now = datetime.now(timezone.utc).isoformat()
    doc = {k: v for k, v in input.dict(exclude_unset=True).items() if v not in ("", None)}
    doc["updated_at"] = now
    doc["connected_by"] = user["id"]
    doc["last_sync_at"] = ""
    await db.pms_connections.update_one({"provider": input.provider}, {"$set": doc}, upsert=True)
    return {"success": True, "message": f"{input.provider.capitalize()} connected."}

@router.delete("/connect/{provider}")
async def disconnect_pms(provider: str, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")
    await db.pms_connections.delete_one({"provider": provider})
    return {"success": True}

@router.post("/sync/{provider}")
async def sync_reservations(provider: str, request: Request):
    """Trigger reservation sync from the connected PMS.
    For MVP, this generates 5 mock reservations tagged with the provider.
    Real adapter should call the PMS API and write into `reservations` collection.
    """
    tdb, user = await get_tenant_db(request)
    db = tdb
    if user.get("role") == "guest":
        raise HTTPException(403, "Admin only")

    conn = await db.pms_connections.find_one({"provider": provider})
    if not conn:
        raise HTTPException(404, "Not connected")

    now = datetime.now(timezone.utc)
    properties = await db.properties.find({}).limit(3).to_list(3)
    if not properties:
        return {"success": False, "message": "No properties to assign reservations to", "synced": 0}

    # Stubbed sync: create a few sample reservations tagged with provider
    import random
    from datetime import timedelta
    created = 0
    for i in range(5):
        p = properties[i % len(properties)]
        check_in = now + timedelta(days=random.randint(1, 30))
        check_out = check_in + timedelta(days=random.randint(2, 7))
        doc = {
            "property_id": str(p["_id"]),
            "property_name": p.get("nickname") or p.get("name", ""),
            "guest_name": f"Synced Guest {i+1}",
            "guest_email": f"guest{i+1}@{provider}.synced",
            "guest_phone": "",
            "check_in_at": check_in.isoformat(),
            "check_out_at": check_out.isoformat(),
            "reservation_status": "confirmed",
            "source_platform": provider,
            "synced_at": now.isoformat(),
            "created_at": now.isoformat(),
        }
        await db.reservations.insert_one(doc)
        created += 1

    await db.pms_connections.update_one({"provider": provider}, {"$set": {"last_sync_at": now.isoformat(), "last_sync_count": created}})
    return {"success": True, "synced": created, "message": f"Synced {created} reservations from {provider}."}

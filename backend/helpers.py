import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request
from bson import ObjectId

JWT_ALGORITHM = "HS256"

def get_jwt_secret():
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str, tenant_id: str = "default", is_platform_admin: bool = False) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "tenant_id": tenant_id,
        "is_platform_admin": is_platform_admin,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request, db) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        del user["_id"]
        user.pop("password_hash", None)
        # Ensure tenant_id always present (from JWT if available, fallback to user doc, else default tenant)
        user["tenant_id"] = payload.get("tenant_id") or user.get("tenant_id", "default")
        user["is_platform_admin"] = bool(user.get("is_platform_admin", False))
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def tenant_filter(user: dict, extra: dict = None) -> dict:
    """Build a query filter that restricts results to the user's tenant.
    Platform admins bypass the filter (see all tenants' data).
    """
    q = dict(extra or {})
    if not user.get("is_platform_admin"):
        q["tenant_id"] = user.get("tenant_id", "default")
    return q

def tenant_doc(user: dict, doc: dict) -> dict:
    """Ensure a doc being inserted gets stamped with the user's tenant_id."""
    if "tenant_id" not in doc:
        doc["tenant_id"] = user.get("tenant_id", "default")
    return doc

# ===== Feature gating =====
FEATURE_TIER = {
    # Pro tier features
    "sms": "pro", "email": "pro", "pms": "pro", "ai": "pro", "otp": "pro",
    "white_label": "pro", "push": "pro", "assets": "pro", "owner_storage": "pro",
    "csv_export": "pro", "advanced_reports": "pro",
    # Enterprise tier features
    "hcp": "enterprise", "scorecards": "enterprise", "api_access": "enterprise",
    "multi_admin": "enterprise", "custom_domain": "enterprise",
}
TIER_ORDER = {"starter": 1, "pro": 2, "enterprise": 3}

async def check_feature(db, user: dict, feature: str) -> bool:
    """Return True if user's tenant plan unlocks this feature."""
    if user.get("is_platform_admin"):
        return True
    tenant_id = user.get("tenant_id", "default")
    tenant = await db.tenants.find_one({"tenant_id": tenant_id})
    if not tenant:
        return False
    plan = tenant.get("plan", "starter")
    required = FEATURE_TIER.get(feature, "starter")
    return TIER_ORDER.get(plan, 0) >= TIER_ORDER.get(required, 99)

async def require_feature(db, user: dict, feature: str):
    if not await check_feature(db, user, feature):
        raise HTTPException(status_code=402, detail=f"Feature '{feature}' requires upgrade. Please upgrade your plan.")

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    result = {}
    for key, value in doc.items():
        if key == "_id":
            result["id"] = str(value)
        elif isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, list):
            result[key] = [serialize_doc(v) if isinstance(v, dict) else str(v) if isinstance(v, ObjectId) else v for v in value]
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        else:
            result[key] = value
    return result

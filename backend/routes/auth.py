from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
from helpers import hash_password, verify_password, create_access_token, create_refresh_token, get_current_user, serialize_doc

router = APIRouter(prefix="/api/auth", tags=["auth"])

class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str = "property_manager"
    phone: str = ""
    company_name: str = ""

class LoginInput(BaseModel):
    email: EmailStr
    password: str

def get_db(request: Request):
    return request.app.state.db

@router.post("/register")
async def register(input: RegisterInput, request: Request, response: Response):
    db = get_db(request)
    email = input.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "email": email,
        "password_hash": hash_password(input.password),
        "first_name": input.first_name,
        "last_name": input.last_name,
        "role": input.role,
        "phone": input.phone,
        "company_name": input.company_name,
        "status": "active",
        "language": "en",
        "avatar_url": "",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {
        "id": user_id,
        "email": email,
        "first_name": input.first_name,
        "last_name": input.last_name,
        "role": input.role,
        "token": access_token
    }

@router.post("/login")
async def login(input: LoginInput, request: Request, response: Response):
    db = get_db(request)
    email = input.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(input.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {
        "id": user_id,
        "email": email,
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name", ""),
        "role": user.get("role", "property_manager"),
        "token": access_token
    }

@router.get("/me")
async def get_me(request: Request):
    db = get_db(request)
    user = await get_current_user(request, db)
    return user

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}


class DemoLeadInput(BaseModel):
    name: str
    email: EmailStr
    role: str = "property_manager"  # property_manager, cleaner, maintenance, vendor

DEMO_ACCOUNTS = {
    "property_manager": {"email": "admin@example.com", "password": "admin123", "label": "Host / Manager"},
    "cleaner": {"email": "maria@example.com", "password": "cleaner123", "label": "Cleaner"},
    "maintenance": {"email": "jake@maintenance.com", "password": "Maint1234!", "label": "Maintenance"},
    "vendor": {"email": "bob@fixitpro.com", "password": "vendor123", "label": "Vendor"},
}

@router.post("/demo-access")
async def demo_access(input: DemoLeadInput, request: Request, response: Response):
    """Capture lead info, then log them into a demo account with a 1-hour expiry."""
    db = get_db(request)
    now = datetime.now(timezone.utc)
    
    # Save demo lead
    await db.demo_leads.update_one(
        {"email": input.email.lower()},
        {"$set": {
            "name": input.name,
            "email": input.email.lower(),
            "demo_role": input.role,
            "last_demo_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }, "$inc": {"demo_count": 1}, "$setOnInsert": {"created_at": now.isoformat()}},
        upsert=True
    )
    
    # Get demo account credentials
    demo = DEMO_ACCOUNTS.get(input.role, DEMO_ACCOUNTS["property_manager"])
    user = await db.users.find_one({"email": demo["email"]})
    if not user:
        raise HTTPException(status_code=404, detail="Demo account not available")
    
    user_id = str(user["_id"])
    # Create token with 1-hour expiry
    access_token = create_access_token(user_id, demo["email"])
    
    from datetime import timedelta
    demo_expires_at = (now + timedelta(hours=1)).isoformat()
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    
    return {
        "id": user_id,
        "email": demo["email"],
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name", ""),
        "role": user.get("role", input.role),
        "token": access_token,
        "is_demo": True,
        "demo_expires_at": demo_expires_at,
        "demo_role_label": demo["label"],
    }

@router.get("/demo-leads")
async def list_demo_leads(request: Request):
    """Admin: view all demo leads captured."""
    db = get_db(request)
    user = await get_current_user(request, db)
    if user.get("role") not in ["property_manager", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    leads = await db.demo_leads.find().sort("last_demo_at", -1).to_list(200)
    return [serialize_doc(l) for l in leads]

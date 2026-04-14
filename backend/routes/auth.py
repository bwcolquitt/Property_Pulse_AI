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

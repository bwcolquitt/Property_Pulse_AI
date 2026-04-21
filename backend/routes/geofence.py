from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from helpers import get_current_user, serialize_doc
from tenant_db import get_tenant_db
from datetime import datetime, timezone
from bson import ObjectId
import math

router = APIRouter(prefix="/api/geofence", tags=["geofence"])

def get_db(request: Request):
    return request.app.state.db

GEOFENCE_RADIUS_METERS = 150  # Default geofence radius

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    turnover_id: Optional[str] = None

class GeofenceCheck(BaseModel):
    latitude: float
    longitude: float
    property_id: str

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two GPS coordinates in meters."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

@router.post("/update-location")
async def update_location(input: LocationUpdate, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    now = datetime.now(timezone.utc).isoformat()
    await db.user_locations.update_one(
        {"user_id": user["id"]},
        {"$set": {"latitude": input.latitude, "longitude": input.longitude, "updated_at": now, "turnover_id": input.turnover_id}},
        upsert=True
    )
    # Check geofence if user has active turnover
    if input.turnover_id:
        turnover = await db.turnovers.find_one({"_id": ObjectId(input.turnover_id)})
        if turnover and turnover.get("property_id"):
            try:
                prop = await db.properties.find_one({"_id": ObjectId(turnover["property_id"])})
                if prop and prop.get("latitude") and prop.get("longitude"):
                    distance = haversine_distance(input.latitude, input.longitude, prop["latitude"], prop["longitude"])
                    radius = prop.get("geofence_radius", GEOFENCE_RADIUS_METERS)
                    inside = distance <= radius
                    return {"inside_geofence": inside, "distance_meters": round(distance), "radius_meters": radius, "property_name": prop.get("nickname", prop.get("name", ""))}
            except Exception:
                pass
    return {"inside_geofence": None, "distance_meters": None}

@router.post("/check")
async def check_geofence(input: GeofenceCheck, request: Request):
    tdb, user = await get_tenant_db(request)
    db = tdb
    prop = await db.properties.find_one({"_id": ObjectId(input.property_id)})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if not prop.get("latitude") or not prop.get("longitude"):
        return {"inside_geofence": True, "message": "No coordinates set for property"}
    distance = haversine_distance(input.latitude, input.longitude, prop["latitude"], prop["longitude"])
    radius = prop.get("geofence_radius", GEOFENCE_RADIUS_METERS)
    return {"inside_geofence": distance <= radius, "distance_meters": round(distance), "radius_meters": radius}

@router.post("/auto-complete")
async def auto_complete_on_exit(input: LocationUpdate, request: Request):
    """Auto-complete checklist when user leaves geofence."""
    tdb, user = await get_tenant_db(request)
    db = tdb
    if not input.turnover_id:
        return {"auto_completed": False, "reason": "No active turnover"}
    turnover = await db.turnovers.find_one({"_id": ObjectId(input.turnover_id)})
    if not turnover or turnover.get("status") in ["completed", "new"]:
        return {"auto_completed": False, "reason": "Turnover not active"}
    prop = await db.properties.find_one({"_id": ObjectId(turnover["property_id"])})
    if not prop or not prop.get("latitude"):
        return {"auto_completed": False, "reason": "No geofence configured"}
    distance = haversine_distance(input.latitude, input.longitude, prop["latitude"], prop["longitude"])
    radius = prop.get("geofence_radius", GEOFENCE_RADIUS_METERS)
    if distance > radius:
        # User left geofence - auto complete remaining checklist items
        checklist = await db.turnover_checklists.find_one({"turnover_id": input.turnover_id})
        if checklist:
            now = datetime.now(timezone.utc).isoformat()
            result = await db.turnover_checklist_items.update_many(
                {"turnover_checklist_id": str(checklist["_id"]), "status": "pending"},
                {"$set": {"status": "completed", "completed_at": now, "completed_by_user_id": user["id"], "note": "Auto-completed (geofence exit)"}}
            )
            await db.turnover_checklists.update_one({"_id": checklist["_id"]}, {"$set": {"completion_percent": 100, "status": "completed"}})
            await db.turnovers.update_one({"_id": ObjectId(input.turnover_id)}, {"$set": {"status": "ready_for_inspection", "updated_at": now}})
            # Notify admins
            from routes.notifications import notify_admins
            prop_name = prop.get("nickname", prop.get("name", ""))
            await notify_admins(db, "geofence_auto_complete", f"Auto-Completed: {prop_name}", f"Checklist auto-completed when {user.get('first_name','')} left the property geofence. {result.modified_count} items marked complete.", f"/turnover/{input.turnover_id}")
            return {"auto_completed": True, "items_completed": result.modified_count, "distance_meters": round(distance)}
    return {"auto_completed": False, "inside_geofence": True, "distance_meters": round(distance)}

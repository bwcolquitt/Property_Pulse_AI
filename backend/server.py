from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging

from routes.auth import router as auth_router
from routes.dashboard import router as dashboard_router
from routes.properties import router as properties_router
from routes.turnovers import router as turnovers_router
from routes.maintenance import router as maintenance_router
from routes.marketplace import router as marketplace_router
from routes.messages import router as messages_router
from routes.reports import router as reports_router
from routes.ai import router as ai_router
from routes.media import router as media_router
from routes.inspections import router as inspections_router
from routes.inventory import router as inventory_router
from routes.quotes import router as quotes_router
from routes.notifications import router as notifications_router
from routes.geofence import router as geofence_router
from routes.inventory_v2 import router as inventory_v2_router
from routes.issues_v2 import router as issues_v2_router
from routes.service_settings import router as service_settings_router
from routes.admin import router as admin_router
from seed import seed_database

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ.get('DB_NAME', 'test_database')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Create app
app = FastAPI(title="Property Pulse - Rental Turnover Platform")

# Store db in app state for access in routes
app.state.db = db

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(properties_router)
app.include_router(turnovers_router)
app.include_router(maintenance_router)
app.include_router(marketplace_router)
app.include_router(messages_router)
app.include_router(reports_router)
app.include_router(ai_router)
app.include_router(media_router)
app.include_router(inspections_router)
app.include_router(inventory_router)
app.include_router(quotes_router)
app.include_router(notifications_router)
app.include_router(geofence_router)
app.include_router(inventory_v2_router)
app.include_router(issues_v2_router)
app.include_router(service_settings_router)
app.include_router(admin_router)

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "property-pulse"}

@app.on_event("startup")
async def startup_event():
    logger.info("Starting Property Pulse backend...")
    await seed_database(db)
    logger.info("Backend ready!")

@app.on_event("shutdown")
async def shutdown_event():
    client.close()

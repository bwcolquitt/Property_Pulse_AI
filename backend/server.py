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
from routes.ai_smart import router as ai_smart_router
from routes.schedules import router as schedules_router
from routes.reservations import router as reservations_router
from routes.job_board import router as job_board_router
from routes.assets import router as assets_router
from routes.supply_requests import router as supply_requests_router
from routes.payments import router as payments_router
from routes.guest_booking import router as guest_booking_router
from routes.ai_chat import router as ai_chat_router
from routes.guides import router as guides_router
from routes.company_config import router as company_config_router
from routes.maintenance_hub import router as maintenance_hub_router
from routes.property_notes import router as property_notes_router
from routes.guest_inventory import router as guest_inventory_router
from routes.onsite_purchases import router as onsite_purchases_router
from routes.improvements import router as improvements_router
from routes.crew_alerts import router as crew_alerts_router
from routes.inspection_prep import router as inspection_prep_router
from routes.guest_portal import router as guest_portal_router
from routes.guest_messages import router as guest_messages_router
from routes.owners_inventory import router as owners_inventory_router
from routes.sms import router as sms_router
from routes.pms_integrations import router as pms_router
from routes.ical_import import router as ical_router
from routes.email_delivery import router as email_router
from routes.hcp_integration import router as hcp_router
from routes.scorecards import router as scorecards_router
from routes.push_notifications import router as push_router
from routes.setup_wizard import router as setup_router
from scheduler import start_scheduler, stop_scheduler
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
app.include_router(ai_smart_router)
app.include_router(schedules_router)
app.include_router(reservations_router)
app.include_router(job_board_router)
app.include_router(assets_router)
app.include_router(supply_requests_router)
app.include_router(payments_router)
app.include_router(guest_booking_router)
app.include_router(ai_chat_router)
app.include_router(guides_router)
app.include_router(company_config_router)
app.include_router(maintenance_hub_router)
app.include_router(property_notes_router)
app.include_router(guest_inventory_router)
app.include_router(onsite_purchases_router)
app.include_router(improvements_router)
app.include_router(crew_alerts_router)
app.include_router(inspection_prep_router)
app.include_router(guest_portal_router)
app.include_router(guest_messages_router)
app.include_router(owners_inventory_router)
app.include_router(sms_router)
app.include_router(pms_router)
app.include_router(ical_router)
app.include_router(email_router)
app.include_router(hcp_router)
app.include_router(scorecards_router)
app.include_router(push_router)
app.include_router(setup_router)

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "property-pulse"}

@app.on_event("startup")
async def startup_event():
    logger.info("Starting Property Pulse backend...")
    await seed_database(db)
    try:
        start_scheduler(db)
    except Exception as e:
        logger.warning(f"Scheduler start failed: {e}")
    logger.info("Backend ready!")
    logger.info("Backend ready!")

@app.on_event("shutdown")
async def shutdown_event():
    client.close()

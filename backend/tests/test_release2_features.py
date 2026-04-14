"""
Backend tests for PropertyPulse Release 2 features:
- AI endpoints (predictive-readiness, classify-severity, generate-checklist, risk-score)
- Media upload
- Inspections CRUD
- Inventory management
- Marketplace quotes/bidding
"""
import pytest
import requests
import os
import base64

# Use the public backend URL from frontend env
BASE_URL = "https://property-pulse-207.preview.emergentagent.com"

class TestAIEndpoints:
    """AI endpoints using GPT-5.2"""

    def test_predictive_readiness_portfolio(self, auth_token):
        """Test POST /api/ai/predictive-readiness for portfolio analysis"""
        response = requests.post(
            f"{BASE_URL}/api/ai/predictive-readiness",
            json={},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "properties" in data
        assert "portfolio_average" in data
        assert "at_risk_count" in data
        assert "generated_at" in data
        assert isinstance(data["properties"], list)
        assert isinstance(data["portfolio_average"], int)
        print(f"✅ Predictive readiness: {len(data['properties'])} properties, avg score: {data['portfolio_average']}")

    def test_classify_severity(self, auth_token):
        """Test POST /api/ai/classify-severity"""
        response = requests.post(
            f"{BASE_URL}/api/ai/classify-severity",
            json={
                "title": "Broken AC unit",
                "description": "Air conditioning not working in master bedroom",
                "location": "Master Bedroom",
                "trade_type": "hvac"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "classification" in data
        assert "classified_by" in data
        assert data["classified_by"] == "gpt-5.2"
        classification = data["classification"]
        assert "priority" in classification
        assert "guest_impact_level" in classification
        assert "blocks_check_in" in classification
        assert classification["priority"] in ["urgent", "high", "medium", "low"]
        print(f"✅ Severity classification: {classification['priority']} priority, guest impact: {classification['guest_impact_level']}")

    def test_generate_checklist(self, auth_token):
        """Test POST /api/ai/generate-checklist"""
        response = requests.post(
            f"{BASE_URL}/api/ai/generate-checklist",
            json={
                "property_type": "vacation_rental",
                "bedrooms": 3,
                "bathrooms": 2,
                "special_notes": "Pet-friendly property"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "checklist" in data
        assert "generated_by" in data
        assert "generated_at" in data
        assert data["generated_by"] == "gpt-5.2"
        assert isinstance(data["checklist"], list)
        assert len(data["checklist"]) > 0
        # Verify checklist item structure
        item = data["checklist"][0]
        assert "room_name" in item
        assert "title" in item
        assert "description" in item
        print(f"✅ Checklist generated: {len(data['checklist'])} tasks")

    def test_risk_score_requires_property_id(self, auth_token, test_property_id):
        """Test POST /api/ai/risk-score"""
        response = requests.post(
            f"{BASE_URL}/api/ai/risk-score",
            json={"property_id": test_property_id},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "overall_risk_score" in data
        assert "risk_level" in data
        assert "blocking_factors" in data
        assert "recommendations" in data
        assert "guest_readiness" in data
        assert data["risk_level"] in ["low", "moderate", "high", "critical"]
        assert isinstance(data["overall_risk_score"], (int, float))
        assert 0 <= data["overall_risk_score"] <= 100
        print(f"✅ Risk score: {data['overall_risk_score']}/100, level: {data['risk_level']}")


class TestMediaUpload:
    """Media upload endpoints"""

    def test_upload_photo_base64(self, auth_token, test_property_id):
        """Test POST /api/media/upload with base64 photo"""
        # Create a tiny 1x1 red pixel PNG in base64
        tiny_png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        
        response = requests.post(
            f"{BASE_URL}/api/media/upload",
            json={
                "owner_type": "property",
                "owner_id": test_property_id,
                "media_type": "photo",
                "base64_data": tiny_png_base64,
                "filename": "test_photo.png"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "file_id" in data
        assert "file_url" in data
        assert "media_type" in data
        assert data["media_type"] == "photo"
        assert data["owner_type"] == "property"
        print(f"✅ Photo uploaded: {data['file_id']}")
        return data["file_id"]

    def test_list_media(self, auth_token, test_property_id):
        """Test GET /api/media/list/{owner_type}/{owner_id}"""
        response = requests.get(
            f"{BASE_URL}/api/media/list/property/{test_property_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Media list retrieved: {len(data)} items")


class TestInspections:
    """Inspections CRUD"""

    def test_list_inspections(self, auth_token):
        """Test GET /api/inspections"""
        response = requests.get(
            f"{BASE_URL}/api/inspections",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Inspections list: {len(data)} inspections")

    def test_list_inspections_with_status_filter(self, auth_token):
        """Test GET /api/inspections?status=pending"""
        response = requests.get(
            f"{BASE_URL}/api/inspections?status=pending",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned inspections should have status=pending
        for insp in data:
            assert insp["status"] == "pending"
        print(f"✅ Inspections filtered by status: {len(data)} pending")

    def test_create_inspection(self, auth_token, test_property_id):
        """Test POST /api/inspections"""
        response = requests.post(
            f"{BASE_URL}/api/inspections",
            json={
                "property_id": test_property_id,
                "due_at": "2026-05-01T14:00:00Z"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["property_id"] == test_property_id
        assert data["status"] == "pending"
        print(f"✅ Inspection created: {data['id']}")
        
        # Verify it was persisted
        get_response = requests.get(
            f"{BASE_URL}/api/inspections/{data['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        retrieved = get_response.json()
        assert retrieved["id"] == data["id"]
        assert retrieved["status"] == "pending"
        print(f"✅ Inspection verified in database")


class TestInventory:
    """Inventory management"""

    def test_list_inventory(self, auth_token):
        """Test GET /api/inventory"""
        response = requests.get(
            f"{BASE_URL}/api/inventory",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Inventory list: {len(data)} items")

    def test_list_inventory_low_stock_filter(self, auth_token):
        """Test GET /api/inventory?low_stock=true"""
        response = requests.get(
            f"{BASE_URL}/api/inventory?low_stock=true",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned items should have is_low_stock=true
        for item in data:
            assert item["is_low_stock"] == True
        print(f"✅ Low stock filter: {len(data)} items low on stock")

    def test_list_supply_requests(self, auth_token):
        """Test GET /api/inventory/supply-requests"""
        response = requests.get(
            f"{BASE_URL}/api/inventory/supply-requests",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Supply requests list: {len(data)} requests")


class TestMarketplaceQuotes:
    """Marketplace quotes/bidding"""

    def test_submit_quote(self, auth_token, test_job_post_id):
        """Test POST /api/marketplace/quotes"""
        response = requests.post(
            f"{BASE_URL}/api/marketplace/quotes",
            json={
                "job_post_id": test_job_post_id,
                "amount": 150.00,
                "note": "Can complete within 24 hours"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["job_post_id"] == test_job_post_id
        assert data["amount"] == 150.00
        assert data["status"] == "pending"
        print(f"✅ Quote submitted: ${data['amount']}")
        return data["id"]

    def test_list_quotes_for_job(self, auth_token, test_job_post_id):
        """Test GET /api/marketplace/quotes/{job_post_id}"""
        response = requests.get(
            f"{BASE_URL}/api/marketplace/quotes/{test_job_post_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Quotes for job: {len(data)} quotes")


# Fixtures
@pytest.fixture(scope="session")
def auth_token():
    """Login as admin and return Bearer token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@example.com", "password": "admin123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    return data["token"]

@pytest.fixture(scope="session")
def test_property_id(auth_token):
    """Get first property ID from seeded data"""
    response = requests.get(
        f"{BASE_URL}/api/properties",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    properties = response.json()
    assert len(properties) > 0
    return properties[0]["id"]

@pytest.fixture(scope="session")
def test_job_post_id(auth_token):
    """Get first job post ID from marketplace"""
    response = requests.get(
        f"{BASE_URL}/api/marketplace/jobs",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    jobs = response.json()
    if len(jobs) == 0:
        pytest.skip("No job posts available for testing")
    return jobs[0]["id"]

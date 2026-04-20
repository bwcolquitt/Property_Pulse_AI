#!/usr/bin/env python3
"""
PropertyPulse Backend API Testing
Tests the new backend APIs as specified in the review request.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend .env
BASE_URL = "https://property-pulse-207.preview.emergentagent.com/api"

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"

class PropertyPulseAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.property_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def authenticate(self):
        """Get JWT token for authentication"""
        print("\n=== AUTHENTICATION ===")
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token") or data.get("access_token")
                if self.token:
                    self.session.headers.update({"Authorization": f"Bearer {self.token}"})
                    self.log_test("Authentication", True, f"JWT token obtained")
                    return True
                else:
                    self.log_test("Authentication", False, f"No token in response: {data}")
                    return False
            else:
                self.log_test("Authentication", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def get_real_property_id(self):
        """Get a real property ID for testing"""
        print("\n=== GETTING REAL PROPERTY ID ===")
        try:
            response = self.session.get(f"{BASE_URL}/properties")
            if response.status_code == 200:
                properties = response.json()
                if properties and len(properties) > 0:
                    self.property_id = properties[0]["id"]
                    property_name = properties[0].get("name", "Unknown")
                    self.log_test("Get Property ID", True, f"Using property: {property_name} (ID: {self.property_id})")
                    return True
                else:
                    self.log_test("Get Property ID", False, "No properties found")
                    return False
            else:
                self.log_test("Get Property ID", False, f"Status {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Get Property ID", False, f"Exception: {str(e)}")
            return False
    
    def test_maintenance_hub(self):
        """Test Maintenance Hub APIs"""
        print("\n=== MAINTENANCE HUB APIS ===")
        
        # Test GET /api/maintenance-hub/outstanding
        try:
            response = self.session.get(f"{BASE_URL}/maintenance-hub/outstanding")
            if response.status_code == 200:
                data = response.json()
                self.log_test("Maintenance Hub - Outstanding Issues", True, f"Found {len(data)} outstanding issues")
            else:
                self.log_test("Maintenance Hub - Outstanding Issues", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Maintenance Hub - Outstanding Issues", False, f"Exception: {str(e)}")
        
        # Test GET /api/maintenance-hub/stats
        try:
            response = self.session.get(f"{BASE_URL}/maintenance-hub/stats")
            if response.status_code == 200:
                data = response.json()
                expected_keys = ["total_open", "urgent", "high", "blocked", "not_started", "in_progress"]
                if all(key in data for key in expected_keys):
                    self.log_test("Maintenance Hub - Stats", True, f"Stats: {data}")
                else:
                    self.log_test("Maintenance Hub - Stats", False, f"Missing expected keys in response: {data}")
            else:
                self.log_test("Maintenance Hub - Stats", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Maintenance Hub - Stats", False, f"Exception: {str(e)}")
    
    def test_property_notes(self):
        """Test Property Notes APIs"""
        print("\n=== PROPERTY NOTES APIS ===")
        
        # Test PUT /api/property-notes/test123
        test_property_id = "test123"
        notes_data = {
            "property_id": test_property_id,
            "garage_code": "#1234",
            "wifi_network": "TestNet",
            "wifi_password": "pass123",
            "front_door_code": "5678",
            "special_instructions": "Ring doorbell on arrival"
        }
        
        try:
            response = self.session.put(f"{BASE_URL}/property-notes/{test_property_id}", json=notes_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("Property Notes - Update", True, f"Notes updated for property {test_property_id}")
                else:
                    self.log_test("Property Notes - Update", False, f"Success=False in response: {data}")
            else:
                self.log_test("Property Notes - Update", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Property Notes - Update", False, f"Exception: {str(e)}")
        
        # Test GET /api/property-notes/test123
        try:
            response = self.session.get(f"{BASE_URL}/property-notes/{test_property_id}")
            if response.status_code == 200:
                data = response.json()
                if data.get("garage_code") == "#1234" and data.get("wifi_network") == "TestNet":
                    self.log_test("Property Notes - Get", True, f"Retrieved notes correctly: garage_code={data.get('garage_code')}, wifi_network={data.get('wifi_network')}")
                else:
                    self.log_test("Property Notes - Get", False, f"Data mismatch: {data}")
            else:
                self.log_test("Property Notes - Get", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Property Notes - Get", False, f"Exception: {str(e)}")
    
    def test_guest_inventory(self):
        """Test Guest Inventory APIs"""
        print("\n=== GUEST INVENTORY APIS ===")
        
        if not self.property_id:
            self.log_test("Guest Inventory - No Property ID", False, "Cannot test without real property ID")
            return
        
        # Test POST /api/guest-inventory
        inventory_data = {
            "property_id": self.property_id,
            "name": "Beach Towels",
            "category": "linens",
            "location": "Pool closet",
            "replacement_cost": 25,
            "quantity": 6
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/guest-inventory", json=inventory_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("name") == "Beach Towels" and data.get("replacement_cost") == 25:
                    self.log_test("Guest Inventory - Create Item", True, f"Created item: {data.get('name')} (${data.get('replacement_cost')})")
                else:
                    self.log_test("Guest Inventory - Create Item", False, f"Data mismatch: {data}")
            else:
                self.log_test("Guest Inventory - Create Item", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Guest Inventory - Create Item", False, f"Exception: {str(e)}")
        
        # Test GET /api/guest-inventory/{property_id} (public, no auth)
        try:
            # Remove auth header for public endpoint
            headers_backup = self.session.headers.copy()
            if "Authorization" in self.session.headers:
                del self.session.headers["Authorization"]
            
            response = self.session.get(f"{BASE_URL}/guest-inventory/{self.property_id}")
            
            # Restore auth header
            self.session.headers.update(headers_backup)
            
            if response.status_code == 200:
                data = response.json()
                if "items" in data and "total_value" in data and "property_name" in data:
                    items_count = len(data["items"])
                    total_value = data["total_value"]
                    self.log_test("Guest Inventory - Get Public", True, f"Found {items_count} items, total value: ${total_value}")
                else:
                    self.log_test("Guest Inventory - Get Public", False, f"Missing expected keys: {data}")
            else:
                self.log_test("Guest Inventory - Get Public", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Guest Inventory - Get Public", False, f"Exception: {str(e)}")
    
    def test_onsite_purchases(self):
        """Test On-Site Purchases APIs"""
        print("\n=== ON-SITE PURCHASES APIS ===")
        
        if not self.property_id:
            self.log_test("On-Site Purchases - No Property ID", False, "Cannot test without real property ID")
            return
        
        # Test POST /api/onsite-purchases
        purchase_data = {
            "property_id": self.property_id,
            "item_name": "Propane Tank",
            "quantity": 1,
            "unit_cost": 29.99,
            "notes": "For BBQ grill"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/onsite-purchases", json=purchase_data)
            if response.status_code == 200:
                data = response.json()
                # Verify 25% markup calculation
                expected_subtotal = 29.99 * 1
                expected_service_fee = round(expected_subtotal * 0.25, 2)
                expected_total = round(expected_subtotal + expected_service_fee, 2)
                
                if (data.get("subtotal") == expected_subtotal and 
                    data.get("service_fee") == expected_service_fee and 
                    data.get("total") == expected_total):
                    self.log_test("On-Site Purchases - Create with 25% Markup", True, 
                                f"Subtotal: ${data.get('subtotal')}, Service Fee: ${data.get('service_fee')}, Total: ${data.get('total')}")
                else:
                    self.log_test("On-Site Purchases - Create with 25% Markup", False, 
                                f"Markup calculation error. Expected total: ${expected_total}, Got: ${data.get('total')}")
            else:
                self.log_test("On-Site Purchases - Create with 25% Markup", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("On-Site Purchases - Create with 25% Markup", False, f"Exception: {str(e)}")
        
        # Test GET /api/onsite-purchases
        try:
            response = self.session.get(f"{BASE_URL}/onsite-purchases")
            if response.status_code == 200:
                data = response.json()
                self.log_test("On-Site Purchases - List", True, f"Found {len(data)} purchases")
            else:
                self.log_test("On-Site Purchases - List", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("On-Site Purchases - List", False, f"Exception: {str(e)}")
    
    def test_improvements(self):
        """Test Improvements APIs"""
        print("\n=== IMPROVEMENTS APIS ===")
        
        if not self.property_id:
            self.log_test("Improvements - No Property ID", False, "Cannot test without real property ID")
            return
        
        # Test POST /api/improvements
        improvement_data = {
            "property_id": self.property_id,
            "title": "TV wire needs wire track",
            "description": "Power cable hangs loosely from TV",
            "location": "Living room",
            "priority": "nice_to_have"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/improvements", json=improvement_data)
            if response.status_code == 200:
                data = response.json()
                if (data.get("title") == "TV wire needs wire track" and 
                    data.get("priority") == "nice_to_have" and
                    data.get("status") == "suggested"):
                    self.log_test("Improvements - Create", True, f"Created improvement: {data.get('title')} (Priority: {data.get('priority')})")
                else:
                    self.log_test("Improvements - Create", False, f"Data mismatch: {data}")
            else:
                self.log_test("Improvements - Create", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Improvements - Create", False, f"Exception: {str(e)}")
        
        # Test GET /api/improvements
        try:
            response = self.session.get(f"{BASE_URL}/improvements")
            if response.status_code == 200:
                data = response.json()
                self.log_test("Improvements - List", True, f"Found {len(data)} improvements")
            else:
                self.log_test("Improvements - List", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Improvements - List", False, f"Exception: {str(e)}")
    
    def test_crew_alerts(self):
        """Test Crew Alerts APIs"""
        print("\n=== CREW ALERTS APIS ===")
        
        if not self.property_id:
            self.log_test("Crew Alerts - No Property ID", False, "Cannot test without real property ID")
            return
        
        # Test POST /api/crew-alerts/guest-present
        alert_data = {
            "property_id": self.property_id,
            "notes": "Guests still packing"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/crew-alerts/guest-present", json=alert_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "Alert sent!" in data.get("message", ""):
                    self.log_test("Crew Alerts - Guest Present", True, f"Alert created: {data.get('message')}")
                else:
                    self.log_test("Crew Alerts - Guest Present", False, f"Unexpected response: {data}")
            else:
                self.log_test("Crew Alerts - Guest Present", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Crew Alerts - Guest Present", False, f"Exception: {str(e)}")
        
        # Test GET /api/crew-alerts
        try:
            response = self.session.get(f"{BASE_URL}/crew-alerts")
            if response.status_code == 200:
                data = response.json()
                self.log_test("Crew Alerts - List", True, f"Found {len(data)} active alerts")
            else:
                self.log_test("Crew Alerts - List", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Crew Alerts - List", False, f"Exception: {str(e)}")
    
    def test_inspection_prep(self):
        """Test Inspection Prep APIs"""
        print("\n=== INSPECTION PREP APIS ===")
        
        if not self.property_id:
            self.log_test("Inspection Prep - No Property ID", False, "Cannot test without real property ID")
            return
        
        # Test GET /api/inspection-prep/checklist/{property_id}
        try:
            response = self.session.get(f"{BASE_URL}/inspection-prep/checklist/{self.property_id}")
            if response.status_code == 200:
                data = response.json()
                if "items" in data and len(data["items"]) > 0:
                    items_count = len(data["items"])
                    # Check for some expected default items
                    fire_safety_items = [item for item in data["items"] if item.get("category") == "Fire Safety"]
                    self.log_test("Inspection Prep - Get Checklist", True, 
                                f"Found {items_count} checklist items, {len(fire_safety_items)} fire safety items")
                else:
                    self.log_test("Inspection Prep - Get Checklist", False, f"No items in checklist: {data}")
            else:
                self.log_test("Inspection Prep - Get Checklist", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Inspection Prep - Get Checklist", False, f"Exception: {str(e)}")
        
        # Test POST /api/inspection-prep/ai-recommendations/{property_id}
        try:
            response = self.session.post(f"{BASE_URL}/inspection-prep/ai-recommendations/{self.property_id}")
            if response.status_code == 200:
                data = response.json()
                if "recommendations" in data and "compliance_score" in data:
                    recommendations_count = len(data["recommendations"])
                    compliance_score = data["compliance_score"]
                    self.log_test("Inspection Prep - AI Recommendations", True, 
                                f"Generated {recommendations_count} recommendations, compliance score: {compliance_score}%")
                else:
                    self.log_test("Inspection Prep - AI Recommendations", False, f"Missing expected keys: {data}")
            else:
                self.log_test("Inspection Prep - AI Recommendations", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Inspection Prep - AI Recommendations", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting PropertyPulse Backend API Testing")
        print(f"Backend URL: {BASE_URL}")
        print(f"Test Credentials: {ADMIN_EMAIL}")
        
        # Authentication is required for all tests
        if not self.authenticate():
            print("\n❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Get real property ID for tests that need it
        if not self.get_real_property_id():
            print("\n⚠️  Could not get real property ID. Some tests may fail.")
        
        # Run all API tests
        self.test_maintenance_hub()
        self.test_property_notes()
        self.test_guest_inventory()
        self.test_onsite_purchases()
        self.test_improvements()
        self.test_crew_alerts()
        self.test_inspection_prep()
        
        # Print summary
        self.print_summary()
        
        return True
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("🏁 TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  • {result['test']}")

if __name__ == "__main__":
    tester = PropertyPulseAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
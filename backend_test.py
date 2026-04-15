#!/usr/bin/env python3
"""
PropertyPulse Backend API Testing - New Endpoints
Testing Payment Config API, Guest Booking API, and Inventory Reorder Settings
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://property-pulse-207.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"

class PropertyPulseAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    def authenticate(self):
        """Authenticate and get JWT token"""
        print("🔐 Authenticating...")
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token") or data.get("access_token")
                if self.auth_token:
                    self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                    self.log_test("Authentication", True, f"Logged in as {ADMIN_EMAIL}")
                    return True
                else:
                    self.log_test("Authentication", False, "No access token in response", data)
                    return False
            else:
                self.log_test("Authentication", False, f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def test_payment_config_api(self):
        """Test Payment Configuration API endpoints"""
        print("💳 Testing Payment Config API...")
        
        # 1. GET /api/payments/config (should return empty config initially)
        try:
            response = self.session.get(f"{API_BASE}/payments/config")
            if response.status_code == 200:
                config = response.json()
                expected_keys = ["stripe_publishable_key", "stripe_secret_key_set", "auto_pay_enabled", "auto_pay_on_job_complete", "default_currency"]
                has_all_keys = all(key in config for key in expected_keys)
                self.log_test("GET /api/payments/config", has_all_keys, 
                            f"Config structure correct: {has_all_keys}", config)
            else:
                self.log_test("GET /api/payments/config", False, 
                            f"Status {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/payments/config", False, f"Exception: {str(e)}")
        
        # 2. PUT /api/payments/config (update configuration)
        try:
            config_data = {
                "stripe_publishable_key": "pk_test_abc123",
                "stripe_secret_key": "sk_test_xyz789",
                "auto_pay_enabled": True,
                "auto_pay_on_job_complete": True,
                "default_currency": "usd"
            }
            response = self.session.put(f"{API_BASE}/payments/config", json=config_data)
            if response.status_code == 200:
                result = response.json()
                success = result.get("success", False)
                self.log_test("PUT /api/payments/config", success, 
                            f"Config updated: {result.get('message', '')}")
            else:
                self.log_test("PUT /api/payments/config", False, 
                            f"Status {response.status_code}", response.text)
        except Exception as e:
            self.log_test("PUT /api/payments/config", False, f"Exception: {str(e)}")
        
        # 3. GET /api/payments/config (verify key is saved, secret masked)
        try:
            response = self.session.get(f"{API_BASE}/payments/config")
            if response.status_code == 200:
                config = response.json()
                pub_key_correct = config.get("stripe_publishable_key") == "pk_test_abc123"
                secret_masked = config.get("stripe_secret_key_masked", "").startswith("sk_****")
                secret_set = config.get("stripe_secret_key_set", False)
                auto_pay = config.get("auto_pay_enabled", False)
                
                all_correct = pub_key_correct and secret_masked and secret_set and auto_pay
                self.log_test("GET /api/payments/config (verify)", all_correct,
                            f"Pub key: {pub_key_correct}, Secret masked: {secret_masked}, Auto pay: {auto_pay}")
            else:
                self.log_test("GET /api/payments/config (verify)", False, 
                            f"Status {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/payments/config (verify)", False, f"Exception: {str(e)}")
        
        # 4. GET /api/payments/providers (list provider payment info)
        try:
            response = self.session.get(f"{API_BASE}/payments/providers")
            if response.status_code == 200:
                providers = response.json()
                is_list = isinstance(providers, list)
                self.log_test("GET /api/payments/providers", is_list,
                            f"Returned {len(providers) if is_list else 0} providers")
            else:
                self.log_test("GET /api/payments/providers", False, 
                            f"Status {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/payments/providers", False, f"Exception: {str(e)}")
        
        # 5. GET /api/payments/history (payment history)
        try:
            response = self.session.get(f"{API_BASE}/payments/history")
            if response.status_code == 200:
                history = response.json()
                is_list = isinstance(history, list)
                self.log_test("GET /api/payments/history", is_list,
                            f"Returned {len(history) if is_list else 0} payment records")
            else:
                self.log_test("GET /api/payments/history", False, 
                            f"Status {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/payments/history", False, f"Exception: {str(e)}")
        
        # 6. GET /api/payments/stats (payment statistics)
        try:
            response = self.session.get(f"{API_BASE}/payments/stats")
            if response.status_code == 200:
                stats = response.json()
                expected_keys = ["total_paid", "completed_count", "pending_count"]
                has_all_keys = all(key in stats for key in expected_keys)
                self.log_test("GET /api/payments/stats", has_all_keys,
                            f"Stats: ${stats.get('total_paid', 0):.2f} paid, {stats.get('completed_count', 0)} completed, {stats.get('pending_count', 0)} pending")
            else:
                self.log_test("GET /api/payments/stats", False, 
                            f"Status {response.status_code}", response.text)
        except Exception as e:
            self.log_test("GET /api/payments/stats", False, f"Exception: {str(e)}")
    
    def test_guest_booking_api(self):
        """Test Guest Booking API endpoints (public, no auth needed)"""
        print("🏠 Testing Guest Booking API...")
        
        # Create a session without auth for public endpoints
        public_session = requests.Session()
        
        # 1. GET /api/guest-booking/properties (lists properties with booked_dates)
        try:
            response = public_session.get(f"{API_BASE}/guest-booking/properties")
            if response.status_code == 200:
                properties = response.json()
                is_list = isinstance(properties, list)
                if is_list and len(properties) > 0:
                    # Check structure of first property
                    prop = properties[0]
                    expected_keys = ["id", "name", "address", "property_type", "bedrooms", "bathrooms", "sleeps", "booked_dates"]
                    has_structure = all(key in prop for key in expected_keys)
                    booked_dates_is_list = isinstance(prop.get("booked_dates", []), list)
                    
                    self.log_test("GET /api/guest-booking/properties", has_structure and booked_dates_is_list,
                                f"Found {len(properties)} properties with correct structure")
                    
                    # Store first property ID for booking test
                    self.test_property_id = prop.get("id")
                else:
                    self.log_test("GET /api/guest-booking/properties", is_list,
                                f"Returned {len(properties) if is_list else 0} properties")
                    self.test_property_id = None
            else:
                self.log_test("GET /api/guest-booking/properties", False, 
                            f"Status {response.status_code}", response.text)
                self.test_property_id = None
        except Exception as e:
            self.log_test("GET /api/guest-booking/properties", False, f"Exception: {str(e)}")
            self.test_property_id = None
        
        # 2. POST /api/guest-booking/book (submit booking request)
        if self.test_property_id:
            try:
                # Use future dates to avoid conflicts
                check_in = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
                check_out = (datetime.now() + timedelta(days=35)).strftime("%Y-%m-%d")
                
                booking_data = {
                    "property_id": self.test_property_id,
                    "guest_name": "John Smith",
                    "guest_email": "john.smith@example.com",
                    "guest_phone": "+1-555-0123",
                    "check_in_date": check_in,
                    "check_out_date": check_out,
                    "adults": 2,
                    "children": 0,
                    "infants": 0,
                    "pets": False,
                    "special_requests": "Late check-in requested"
                }
                
                response = public_session.post(f"{API_BASE}/guest-booking/book", json=booking_data)
                if response.status_code == 200:
                    result = response.json()
                    success = result.get("success", False)
                    booking_id = result.get("booking_id")
                    status = result.get("status")
                    
                    booking_success = success and booking_id and status == "pending"
                    self.log_test("POST /api/guest-booking/book", booking_success,
                                f"Booking created: ID {booking_id}, Status: {status}")
                elif response.status_code == 409:
                    # Date conflict is expected behavior
                    self.log_test("POST /api/guest-booking/book", True,
                                "Date conflict detected (expected behavior)")
                else:
                    self.log_test("POST /api/guest-booking/book", False, 
                                f"Status {response.status_code}", response.text)
            except Exception as e:
                self.log_test("POST /api/guest-booking/book", False, f"Exception: {str(e)}")
        else:
            self.log_test("POST /api/guest-booking/book", False, "No property ID available for testing")
    
    def test_inventory_reorder_settings(self):
        """Test Inventory Reorder Settings API"""
        print("📦 Testing Inventory Reorder Settings...")
        
        # 1. GET /api/inventory-v2/items (get first item id)
        try:
            response = self.session.get(f"{API_BASE}/inventory-v2/items")
            if response.status_code == 200:
                items = response.json()
                is_list = isinstance(items, list)
                if is_list and len(items) > 0:
                    self.test_item_id = items[0].get("id")
                    self.log_test("GET /api/inventory-v2/items", True,
                                f"Found {len(items)} inventory items")
                else:
                    self.test_item_id = None
                    self.log_test("GET /api/inventory-v2/items", is_list,
                                f"Returned {len(items) if is_list else 0} items")
            else:
                self.test_item_id = None
                self.log_test("GET /api/inventory-v2/items", False, 
                            f"Status {response.status_code}", response.text)
        except Exception as e:
            self.test_item_id = None
            self.log_test("GET /api/inventory-v2/items", False, f"Exception: {str(e)}")
        
        # 2. PUT /api/inventory-v2/items/{id}/reorder-settings (update reorder settings)
        if self.test_item_id:
            try:
                reorder_data = {
                    "reorder_url": "https://amazon.com/dp/B08N5WRWNW",
                    "reorder_level": 5
                }
                
                response = self.session.put(f"{API_BASE}/inventory-v2/items/{self.test_item_id}/reorder-settings", 
                                          json=reorder_data)
                if response.status_code == 200:
                    result = response.json()
                    success = result.get("success", False)
                    self.log_test("PUT /api/inventory-v2/items/{id}/reorder-settings", success,
                                f"Reorder settings updated for item {self.test_item_id}")
                else:
                    self.log_test("PUT /api/inventory-v2/items/{id}/reorder-settings", False, 
                                f"Status {response.status_code}", response.text)
            except Exception as e:
                self.log_test("PUT /api/inventory-v2/items/{id}/reorder-settings", False, f"Exception: {str(e)}")
        else:
            self.log_test("PUT /api/inventory-v2/items/{id}/reorder-settings", False, 
                        "No inventory item ID available for testing")
    
    def get_real_property_id(self):
        """Get a real property ID for testing"""
        try:
            response = self.session.get(f"{API_BASE}/properties")
            if response.status_code == 200:
                properties = response.json()
                if isinstance(properties, list) and len(properties) > 0:
                    return properties[0].get("id")
        except Exception:
            pass
        return None
    
    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting PropertyPulse Backend API Tests")
        print("=" * 60)
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Test all API groups
        self.test_payment_config_api()
        self.test_guest_booking_api()
        self.test_inventory_reorder_settings()
        
        # Summary
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = PropertyPulseAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
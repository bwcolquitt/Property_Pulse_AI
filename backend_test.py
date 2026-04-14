#!/usr/bin/env python3
"""
PropertyPulse Backend API Testing Suite
Tests all new backend API endpoints as specified in the review request.
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://property-pulse-207.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from test_credentials.md
ADMIN_CREDENTIALS = {
    "email": "admin@example.com",
    "password": "admin123"
}

class PropertyPulseAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.property_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, details="", response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
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
            response = self.session.post(
                f"{API_BASE}/auth/login",
                json=ADMIN_CREDENTIALS,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token") or data.get("access_token")
                if self.auth_token:
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.auth_token}"
                    })
                    self.log_result("Authentication", True, f"Logged in as {ADMIN_CREDENTIALS['email']}")
                    return True
                else:
                    self.log_result("Authentication", False, "No access token in response", data)
                    return False
            else:
                self.log_result("Authentication", False, f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def get_property_id(self):
        """Get a real property ID for testing"""
        print("🏠 Getting property ID...")
        try:
            response = self.session.get(f"{API_BASE}/properties", timeout=10)
            if response.status_code == 200:
                properties = response.json()
                if properties and len(properties) > 0:
                    self.property_id = properties[0]["id"]
                    self.log_result("Get Property ID", True, f"Using property: {self.property_id}")
                    return True
                else:
                    self.log_result("Get Property ID", False, "No properties found")
                    return False
            else:
                self.log_result("Get Property ID", False, f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get Property ID", False, f"Exception: {str(e)}")
            return False
    
    def test_reservations_api(self):
        """Test Reservations API endpoints"""
        print("📅 Testing Reservations API...")
        
        # Test GET /api/reservations
        try:
            response = self.session.get(f"{API_BASE}/reservations", timeout=10)
            if response.status_code == 200:
                reservations = response.json()
                self.log_result("GET /api/reservations", True, f"Retrieved {len(reservations)} reservations")
            else:
                self.log_result("GET /api/reservations", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/reservations", False, f"Exception: {str(e)}")
        
        # Test POST /api/reservations
        if self.property_id:
            try:
                check_in = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%dT15:00:00")
                check_out = (datetime.now() + timedelta(days=11)).strftime("%Y-%m-%dT11:00:00")
                
                reservation_data = {
                    "property_id": self.property_id,
                    "source_system": "direct",
                    "guest_name": "Emma Wilson",
                    "check_in_at": check_in,
                    "check_out_at": check_out,
                    "guest_count": 2
                }
                
                response = self.session.post(f"{API_BASE}/reservations", json=reservation_data, timeout=10)
                if response.status_code == 200:
                    reservation = response.json()
                    self.log_result("POST /api/reservations", True, f"Created reservation: {reservation.get('id')}")
                else:
                    self.log_result("POST /api/reservations", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_result("POST /api/reservations", False, f"Exception: {str(e)}")
        
        # Test POST /api/reservations/sync
        try:
            sync_data = {"source_system": "airbnb"}
            response = self.session.post(f"{API_BASE}/reservations/sync", json=sync_data, timeout=10)
            if response.status_code == 200:
                sync_result = response.json()
                self.log_result("POST /api/reservations/sync", True, f"Synced {sync_result.get('synced_count', 0)} reservations")
            else:
                self.log_result("POST /api/reservations/sync", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST /api/reservations/sync", False, f"Exception: {str(e)}")
        
        # Test GET /api/reservations/stats
        try:
            response = self.session.get(f"{API_BASE}/reservations/stats", timeout=10)
            if response.status_code == 200:
                stats = response.json()
                self.log_result("GET /api/reservations/stats", True, f"Total: {stats.get('total', 0)}, Upcoming: {stats.get('upcoming', 0)}")
            else:
                self.log_result("GET /api/reservations/stats", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/reservations/stats", False, f"Exception: {str(e)}")
    
    def test_job_board_api(self):
        """Test Job Board API endpoints"""
        print("💼 Testing Job Board API...")
        
        # Test GET /api/jobs
        try:
            response = self.session.get(f"{API_BASE}/jobs", timeout=10)
            if response.status_code == 200:
                jobs = response.json()
                self.log_result("GET /api/jobs", True, f"Retrieved {len(jobs)} jobs")
            else:
                self.log_result("GET /api/jobs", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/jobs", False, f"Exception: {str(e)}")
        
        # Test POST /api/jobs
        job_id = None
        if self.property_id:
            try:
                job_data = {
                    "property_id": self.property_id,
                    "title": "Deep clean needed",
                    "description": "Property needs thorough deep cleaning after renovation",
                    "job_type": "cleaning",
                    "urgency": "normal",
                    "budget_min": 100,
                    "budget_max": 200
                }
                
                response = self.session.post(f"{API_BASE}/jobs", json=job_data, timeout=10)
                if response.status_code == 200:
                    job = response.json()
                    job_id = job.get('id')
                    self.log_result("POST /api/jobs", True, f"Created job: {job_id}")
                else:
                    self.log_result("POST /api/jobs", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_result("POST /api/jobs", False, f"Exception: {str(e)}")
        
        # Test GET /api/jobs/{job_id}
        if job_id:
            try:
                response = self.session.get(f"{API_BASE}/jobs/{job_id}", timeout=10)
                if response.status_code == 200:
                    job_detail = response.json()
                    self.log_result("GET /api/jobs/{job_id}", True, f"Retrieved job details with {len(job_detail.get('bids', []))} bids")
                else:
                    self.log_result("GET /api/jobs/{job_id}", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_result("GET /api/jobs/{job_id}", False, f"Exception: {str(e)}")
            
            # Test POST /api/jobs/{job_id}/bids
            try:
                bid_data = {
                    "amount": 150,
                    "estimated_hours": 3,
                    "message": "I can do this job efficiently",
                    "available_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
                }
                
                response = self.session.post(f"{API_BASE}/jobs/{job_id}/bids", json=bid_data, timeout=10)
                if response.status_code == 200:
                    bid = response.json()
                    self.log_result("POST /api/jobs/{job_id}/bids", True, f"Created bid: {bid.get('id')}")
                else:
                    self.log_result("POST /api/jobs/{job_id}/bids", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_result("POST /api/jobs/{job_id}/bids", False, f"Exception: {str(e)}")
    
    def test_assets_api(self):
        """Test Assets API endpoints"""
        print("🏠 Testing Assets API...")
        
        # Test GET /api/assets
        try:
            response = self.session.get(f"{API_BASE}/assets", timeout=10)
            if response.status_code == 200:
                assets = response.json()
                self.log_result("GET /api/assets", True, f"Retrieved {len(assets)} assets")
            else:
                self.log_result("GET /api/assets", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/assets", False, f"Exception: {str(e)}")
        
        # Test POST /api/assets
        if self.property_id:
            try:
                asset_data = {
                    "property_id": self.property_id,
                    "name": "Samsung Dishwasher",
                    "category": "appliance",
                    "manufacturer": "Samsung",
                    "model_number": "DW80R9950US",
                    "condition": "good",
                    "warranty_expiry": "2027-06-01",
                    "location_in_property": "Kitchen"
                }
                
                response = self.session.post(f"{API_BASE}/assets", json=asset_data, timeout=10)
                if response.status_code == 200:
                    asset = response.json()
                    self.log_result("POST /api/assets", True, f"Created asset: {asset.get('id')}")
                else:
                    self.log_result("POST /api/assets", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_result("POST /api/assets", False, f"Exception: {str(e)}")
        
        # Test GET /api/assets/expiring-warranties
        try:
            response = self.session.get(f"{API_BASE}/assets/expiring-warranties", timeout=10)
            if response.status_code == 200:
                expiring = response.json()
                self.log_result("GET /api/assets/expiring-warranties", True, f"Found {len(expiring)} assets with expiring warranties")
            else:
                self.log_result("GET /api/assets/expiring-warranties", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/assets/expiring-warranties", False, f"Exception: {str(e)}")
    
    def test_supply_requests_api(self):
        """Test Supply Requests API endpoints"""
        print("📦 Testing Supply Requests API...")
        
        # Test GET /api/supply-requests
        try:
            response = self.session.get(f"{API_BASE}/supply-requests", timeout=10)
            if response.status_code == 200:
                requests_list = response.json()
                self.log_result("GET /api/supply-requests", True, f"Retrieved {len(requests_list)} supply requests")
            else:
                self.log_result("GET /api/supply-requests", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/supply-requests", False, f"Exception: {str(e)}")
        
        # Test POST /api/supply-requests
        request_id = None
        if self.property_id:
            try:
                supply_data = {
                    "property_id": self.property_id,
                    "items": [
                        {"name": "Bath Towels", "quantity": 10, "category": "linens", "notes": "White, high quality"},
                        {"name": "Toilet Paper", "quantity": 24, "category": "consumables", "notes": "2-ply"}
                    ],
                    "urgency": "normal",
                    "notes": "Needed for upcoming guest turnover"
                }
                
                response = self.session.post(f"{API_BASE}/supply-requests", json=supply_data, timeout=10)
                if response.status_code == 200:
                    supply_request = response.json()
                    request_id = supply_request.get('id')
                    self.log_result("POST /api/supply-requests", True, f"Created supply request: {request_id}")
                else:
                    self.log_result("POST /api/supply-requests", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_result("POST /api/supply-requests", False, f"Exception: {str(e)}")
        
        # Test PUT /api/supply-requests/{id} (approve)
        if request_id:
            try:
                action_data = {"action": "approve", "notes": "Approved for purchase"}
                response = self.session.put(f"{API_BASE}/supply-requests/{request_id}", json=action_data, timeout=10)
                if response.status_code == 200:
                    self.log_result("PUT /api/supply-requests/{id} (approve)", True, "Supply request approved")
                else:
                    self.log_result("PUT /api/supply-requests/{id} (approve)", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_result("PUT /api/supply-requests/{id} (approve)", False, f"Exception: {str(e)}")
        
        # Test GET /api/supply-requests/stats
        try:
            response = self.session.get(f"{API_BASE}/supply-requests/stats", timeout=10)
            if response.status_code == 200:
                stats = response.json()
                self.log_result("GET /api/supply-requests/stats", True, f"Pending: {stats.get('pending', 0)}, Total: {stats.get('total', 0)}")
            else:
                self.log_result("GET /api/supply-requests/stats", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/supply-requests/stats", False, f"Exception: {str(e)}")
    
    def test_reports_api(self):
        """Test Enhanced Reports API endpoints"""
        print("📊 Testing Reports API...")
        
        # Test GET /api/reports (list types)
        try:
            response = self.session.get(f"{API_BASE}/reports", timeout=10)
            if response.status_code == 200:
                report_types = response.json()
                has_financial = any(r.get('id') == 'financial_summary' for r in report_types)
                self.log_result("GET /api/reports", True, f"Retrieved {len(report_types)} report types, financial_summary included: {has_financial}")
            else:
                self.log_result("GET /api/reports", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/reports", False, f"Exception: {str(e)}")
        
        # Test individual report endpoints
        report_endpoints = [
            "outstanding-maintenance",
            "guest-readiness", 
            "cleaner-scorecard",
            "vendor-performance",
            "issue-trends",
            "financial-summary",
            "turnover-completion"
        ]
        
        for endpoint in report_endpoints:
            try:
                response = self.session.get(f"{API_BASE}/reports/{endpoint}", timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    self.log_result(f"GET /api/reports/{endpoint}", True, f"Retrieved report data")
                else:
                    self.log_result(f"GET /api/reports/{endpoint}", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_result(f"GET /api/reports/{endpoint}", False, f"Exception: {str(e)}")
    
    def test_schedules_api(self):
        """Test Schedules API endpoints"""
        print("📅 Testing Schedules API...")
        
        # Test GET /api/schedules/recurring
        try:
            response = self.session.get(f"{API_BASE}/schedules/recurring", timeout=10)
            if response.status_code == 200:
                schedules = response.json()
                self.log_result("GET /api/schedules/recurring", True, f"Retrieved {len(schedules)} recurring schedules")
            else:
                self.log_result("GET /api/schedules/recurring", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/schedules/recurring", False, f"Exception: {str(e)}")
        
        # Test GET /api/schedules/provider-availability-bulk
        try:
            response = self.session.get(f"{API_BASE}/schedules/provider-availability-bulk", timeout=10)
            if response.status_code == 200:
                availability = response.json()
                self.log_result("GET /api/schedules/provider-availability-bulk", True, f"Retrieved availability for {len(availability)} providers")
            else:
                self.log_result("GET /api/schedules/provider-availability-bulk", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET /api/schedules/provider-availability-bulk", False, f"Exception: {str(e)}")
    
    def test_ai_smart_routes(self):
        """Test AI Smart Routes"""
        print("🤖 Testing AI Smart Routes...")
        
        # Test POST /api/ai-smart/auto-schedule
        try:
            schedule_data = {"date_range_days": 7}
            response = self.session.post(f"{API_BASE}/ai-smart/auto-schedule", json=schedule_data, timeout=15)
            if response.status_code == 200:
                result = response.json()
                self.log_result("POST /api/ai-smart/auto-schedule", True, f"Generated schedule with {len(result.get('schedule', []))} items")
            else:
                self.log_result("POST /api/ai-smart/auto-schedule", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST /api/ai-smart/auto-schedule", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting PropertyPulse Backend API Tests")
        print("=" * 50)
        
        # Authentication is required for all tests
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Get property ID for tests that need it
        if not self.get_property_id():
            print("⚠️  No property ID available. Some tests may fail.")
        
        # Run all test suites
        self.test_reservations_api()
        self.test_job_board_api()
        self.test_assets_api()
        self.test_supply_requests_api()
        self.test_reports_api()
        self.test_schedules_api()
        self.test_ai_smart_routes()
        
        # Summary
        print("=" * 50)
        print("📋 TEST SUMMARY")
        print("=" * 50)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
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
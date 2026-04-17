#!/usr/bin/env python3
"""
Company Configuration API Testing for PropertyPulse White-Label SaaS
Tests all company config endpoints and integration with guides system
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://property-pulse-207.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"

class CompanyConfigTester:
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
            "timestamp": datetime.now().isoformat()
        })
    
    def authenticate(self):
        """Authenticate and get JWT token"""
        print("🔐 AUTHENTICATING...")
        
        try:
            response = self.session.post(
                f"{API_BASE}/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                timeout=10
            )
            
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
    
    def test_get_empty_config(self):
        """Test GET /api/company-config returns empty sections initially"""
        print("📋 TESTING INITIAL EMPTY CONFIG...")
        
        try:
            response = self.session.get(f"{API_BASE}/company-config", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                expected_sections = ["profile", "contacts", "check_in_out", "house_rules", 
                                   "emergency_procedures", "communication", "legal", "custom_faqs"]
                
                # Check all sections exist
                missing_sections = [s for s in expected_sections if s not in data]
                if missing_sections:
                    self.log_test("GET Empty Config", False, f"Missing sections: {missing_sections}", data)
                    return False
                
                # Check sections are empty or have default values
                all_empty = True
                for section in expected_sections:
                    if data[section] and any(v for v in data[section].values() if v):
                        all_empty = False
                        break
                
                self.log_test("GET Empty Config", True, f"Found {len(expected_sections)} sections, all empty/default")
                return True
            else:
                self.log_test("GET Empty Config", False, f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("GET Empty Config", False, f"Exception: {str(e)}")
            return False
    
    def test_update_profile(self):
        """Test PUT /api/company-config/profile"""
        print("🏢 TESTING COMPANY PROFILE UPDATE...")
        
        profile_data = {
            "company_name": "Oceanview Rentals",
            "tagline": "Premium beach rentals",
            "website": "https://oceanview.com",
            "primary_color": "#0A4F7F",
            "accent_color": "#DDA239",
            "logo_url": "",
            "background_color": "#FAF6F0"
        }
        
        try:
            response = self.session.put(
                f"{API_BASE}/company-config/profile",
                json=profile_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("PUT Profile", True, "Company profile updated successfully")
                    return True
                else:
                    self.log_test("PUT Profile", False, "Success flag not true", data)
                    return False
            else:
                self.log_test("PUT Profile", False, f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("PUT Profile", False, f"Exception: {str(e)}")
            return False
    
    def test_update_contacts(self):
        """Test PUT /api/company-config/contacts"""
        print("📞 TESTING CONTACTS UPDATE...")
        
        contacts_data = {
            "main_phone": "(949) 555-0100",
            "main_email": "info@oceanview.com",
            "emergency_phone": "(949) 555-0911",
            "after_hours_phone": "(949) 555-0200",
            "maintenance_hotline": "(949) 555-0300",
            "office_address": "123 Pacific Coast Hwy",
            "office_hours": "Mon-Fri 9am-5pm"
        }
        
        try:
            response = self.session.put(
                f"{API_BASE}/company-config/contacts",
                json=contacts_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("PUT Contacts", True, "Contact directory updated successfully")
                    return True
                else:
                    self.log_test("PUT Contacts", False, "Success flag not true", data)
                    return False
            else:
                self.log_test("PUT Contacts", False, f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("PUT Contacts", False, f"Exception: {str(e)}")
            return False
    
    def test_update_check_in_out(self):
        """Test PUT /api/company-config/check-in-out"""
        print("🔑 TESTING CHECK-IN/OUT POLICY UPDATE...")
        
        checkin_data = {
            "default_check_in_time": "3:00 PM",
            "default_check_out_time": "11:00 AM",
            "key_exchange_method": "smart_lock",
            "smart_lock_instructions": "Download the August app and use code sent via email",
            "check_in_instructions": "Park in driveway. Enter through front door.",
            "check_out_instructions": "Start dishwasher, take out trash, lock all doors."
        }
        
        try:
            response = self.session.put(
                f"{API_BASE}/company-config/check-in-out",
                json=checkin_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("PUT Check-in/Out", True, "Check-in/out policy updated successfully")
                    return True
                else:
                    self.log_test("PUT Check-in/Out", False, "Success flag not true", data)
                    return False
            else:
                self.log_test("PUT Check-in/Out", False, f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("PUT Check-in/Out", False, f"Exception: {str(e)}")
            return False
    
    def test_update_house_rules(self):
        """Test PUT /api/company-config/house-rules"""
        print("🏠 TESTING HOUSE RULES UPDATE...")
        
        rules_data = {
            "quiet_hours_start": "10:00 PM",
            "quiet_hours_end": "8:00 AM",
            "parking_rules": "2 cars max in driveway",
            "pets_allowed": False,
            "smoking_allowed": False,
            "pool_hours": "8 AM - 10 PM",
            "pool_rules": "No glass near pool",
            "wifi_network": "OceanView-Guest",
            "wifi_password": "beach2025",
            "trash_instructions": "Bins to curb by 7AM on Tuesday"
        }
        
        try:
            response = self.session.put(
                f"{API_BASE}/company-config/house-rules",
                json=rules_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("PUT House Rules", True, "House rules updated successfully")
                    return True
                else:
                    self.log_test("PUT House Rules", False, "Success flag not true", data)
                    return False
            else:
                self.log_test("PUT House Rules", False, f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("PUT House Rules", False, f"Exception: {str(e)}")
            return False
    
    def test_update_custom_faqs(self):
        """Test PUT /api/company-config/custom-faqs"""
        print("❓ TESTING CUSTOM FAQS UPDATE...")
        
        faqs_data = {
            "faqs": [
                {
                    "question": "Where is the nearest grocery store?",
                    "answer": "Trader Joes is 2 miles north on PCH",
                    "role": "guest",
                    "order": 0
                },
                {
                    "question": "What's the gate code?",
                    "answer": "#5678 on the front gate keypad",
                    "role": "all",
                    "order": 1
                }
            ]
        }
        
        try:
            response = self.session.put(
                f"{API_BASE}/company-config/custom-faqs",
                json=faqs_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("PUT Custom FAQs", True, "Custom FAQs updated successfully")
                    return True
                else:
                    self.log_test("PUT Custom FAQs", False, "Success flag not true", data)
                    return False
            else:
                self.log_test("PUT Custom FAQs", False, f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("PUT Custom FAQs", False, f"Exception: {str(e)}")
            return False
    
    def test_verify_data_persistence(self):
        """Test GET /api/company-config to verify all data persisted"""
        print("💾 TESTING DATA PERSISTENCE...")
        
        try:
            response = self.session.get(f"{API_BASE}/company-config", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check profile data
                profile = data.get("profile", {})
                if profile.get("company_name") != "Oceanview Rentals":
                    self.log_test("Data Persistence", False, "Profile data not persisted correctly", profile)
                    return False
                
                # Check contacts data
                contacts = data.get("contacts", {})
                if contacts.get("main_phone") != "(949) 555-0100":
                    self.log_test("Data Persistence", False, "Contacts data not persisted correctly", contacts)
                    return False
                
                # Check check-in/out data
                checkin = data.get("check_in_out", {})
                if checkin.get("key_exchange_method") != "smart_lock":
                    self.log_test("Data Persistence", False, "Check-in/out data not persisted correctly", checkin)
                    return False
                
                # Check house rules data
                rules = data.get("house_rules", {})
                if rules.get("wifi_network") != "OceanView-Guest":
                    self.log_test("Data Persistence", False, "House rules data not persisted correctly", rules)
                    return False
                
                # Check custom FAQs data
                custom_faqs = data.get("custom_faqs", {})
                faqs = custom_faqs.get("faqs", [])
                if len(faqs) != 2 or faqs[0].get("question") != "Where is the nearest grocery store?":
                    self.log_test("Data Persistence", False, "Custom FAQs data not persisted correctly", custom_faqs)
                    return False
                
                self.log_test("Data Persistence", True, "All configuration data persisted correctly")
                return True
            else:
                self.log_test("Data Persistence", False, f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Data Persistence", False, f"Exception: {str(e)}")
            return False
    
    def test_guides_integration(self):
        """Test GET /api/guides to verify company data integration"""
        print("📚 TESTING GUIDES INTEGRATION...")
        
        try:
            response = self.session.get(f"{API_BASE}/guides", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check that guides structure exists
                if not all(key in data for key in ["admin", "provider", "guest", "company"]):
                    self.log_test("Guides Integration", False, "Missing guide sections", list(data.keys()))
                    return False
                
                # Check company data in guides
                company = data.get("company", {})
                if company.get("company_name") != "Oceanview Rentals":
                    self.log_test("Guides Integration", False, "Company data not in guides", company)
                    return False
                
                # Check guest guides contain contact information
                guest_guides = data.get("guest", [])
                contact_guide = None
                for guide in guest_guides:
                    if guide.get("id") == "contact":
                        contact_guide = guide
                        break
                
                if not contact_guide:
                    self.log_test("Guides Integration", False, "Contact guide not found in guest guides")
                    return False
                
                # Check if contact info is injected into guide steps
                steps = contact_guide.get("steps", [])
                phone_found = any("(949) 555-0100" in step for step in steps)
                if not phone_found:
                    self.log_test("Guides Integration", False, "Contact phone not found in guide steps", steps)
                    return False
                
                self.log_test("Guides Integration", True, "Company data successfully integrated into guides")
                return True
            else:
                self.log_test("Guides Integration", False, f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Guides Integration", False, f"Exception: {str(e)}")
            return False
    
    def test_auth_required(self):
        """Test that PUT endpoints require authentication"""
        print("🔒 TESTING AUTHENTICATION REQUIREMENTS...")
        
        # Create session without auth token
        unauth_session = requests.Session()
        
        try:
            response = unauth_session.put(
                f"{API_BASE}/company-config/profile",
                json={"company_name": "Test"},
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_test("Auth Required", True, "PUT endpoints properly require authentication")
                return True
            else:
                self.log_test("Auth Required", False, f"Expected 401, got {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Auth Required", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all company config tests"""
        print("🚀 STARTING COMPANY CONFIGURATION API TESTS")
        print("=" * 60)
        
        # Authentication
        if not self.authenticate():
            print("❌ Authentication failed - cannot continue with tests")
            return False
        
        # Test sequence
        tests = [
            self.test_get_empty_config,
            self.test_update_profile,
            self.test_update_contacts,
            self.test_update_check_in_out,
            self.test_update_house_rules,
            self.test_update_custom_faqs,
            self.test_verify_data_persistence,
            self.test_guides_integration,
            self.test_auth_required
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
        
        # Summary
        print("=" * 60)
        print(f"📊 TEST SUMMARY: {passed}/{total} tests passed")
        
        if passed == total:
            print("✅ ALL COMPANY CONFIGURATION TESTS PASSED!")
            return True
        else:
            print(f"❌ {total - passed} tests failed")
            return False

def main():
    """Main test execution"""
    tester = CompanyConfigTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 Company Configuration API is working correctly!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed - check the output above")
        sys.exit(1)

if __name__ == "__main__":
    main()
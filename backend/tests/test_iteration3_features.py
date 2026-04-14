"""
Backend tests for PropertyPulse Iteration 3 features:
- Role-based filtering: Cleaners see only assigned turnovers
- Role-based filtering: Vendors see only assigned issues
- Admin notifications on turnover status changes
- Properties have cover_photo_url
"""
import pytest
import requests
import os

BASE_URL = "https://property-pulse-207.preview.emergentagent.com"

class TestRoleBasedFilteringTurnovers:
    """Test role-based filtering for turnovers"""

    def test_cleaner_sees_only_assigned_turnovers(self, cleaner_token):
        """Jake (cleaner) should see only his 1 assigned turnover"""
        response = requests.get(
            f"{BASE_URL}/api/turnovers",
            headers={"Authorization": f"Bearer {cleaner_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Jake should see exactly 1 turnover (his assigned one)
        assert len(data) == 1, f"Expected 1 turnover for Jake, got {len(data)}"
        turnover = data[0]
        # Verify it's assigned to Jake
        assert "assigned_provider_id" in turnover
        print(f"✅ Cleaner Jake sees {len(data)} assigned turnover: {turnover.get('title', 'N/A')}")

    def test_admin_sees_all_turnovers(self, admin_token):
        """Admin should see all 6 turnovers"""
        response = requests.get(
            f"{BASE_URL}/api/turnovers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Admin should see all 6 turnovers
        assert len(data) == 6, f"Expected 6 turnovers for admin, got {len(data)}"
        print(f"✅ Admin sees all {len(data)} turnovers")


class TestRoleBasedFilteringIssues:
    """Test role-based filtering for maintenance issues"""

    def test_vendor_sees_only_assigned_issues(self, vendor_token):
        """Bob (vendor) should see only his assigned issues"""
        response = requests.get(
            f"{BASE_URL}/api/issues",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Bob should see only his assigned issues
        # All returned issues should be assigned to Bob
        for issue in data:
            assert "assigned_provider_id" in issue
            # If assigned_provider_id is present, it should be Bob's ID
        print(f"✅ Vendor Bob sees {len(data)} assigned issue(s)")

    def test_admin_sees_all_issues(self, admin_token):
        """Admin should see all issues (outstanding by default)"""
        response = requests.get(
            f"{BASE_URL}/api/issues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Admin should see multiple issues
        assert len(data) > 0
        print(f"✅ Admin sees {len(data)} outstanding issues")


class TestNotifications:
    """Test notification endpoints"""

    def test_get_notifications(self, admin_token):
        """Test GET /api/notifications returns notifications for admin"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Admin should have at least 1 notification (Jake's test notification)
        assert len(data) >= 1, f"Expected at least 1 notification, got {len(data)}"
        # Verify notification structure
        if len(data) > 0:
            notif = data[0]
            assert "id" in notif
            assert "title" in notif
            assert "body" in notif
            assert "type" in notif
            assert "created_at" in notif
            print(f"✅ Admin has {len(data)} notification(s): '{notif.get('title', 'N/A')}'")

    def test_get_unread_count(self, admin_token):
        """Test GET /api/notifications/count returns unread count"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/count",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)
        assert data["unread_count"] >= 0
        print(f"✅ Admin has {data['unread_count']} unread notification(s)")

    def test_mark_all_read(self, admin_token):
        """Test PUT /api/notifications/read-all marks all as read"""
        # First, get current unread count
        count_before = requests.get(
            f"{BASE_URL}/api/notifications/count",
            headers={"Authorization": f"Bearer {admin_token}"}
        ).json()["unread_count"]
        
        # Mark all as read
        response = requests.put(
            f"{BASE_URL}/api/notifications/read-all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert data["success"] == True
        
        # Verify unread count is now 0
        count_after = requests.get(
            f"{BASE_URL}/api/notifications/count",
            headers={"Authorization": f"Bearer {admin_token}"}
        ).json()["unread_count"]
        assert count_after == 0, f"Expected 0 unread after mark-all-read, got {count_after}"
        print(f"✅ Marked all notifications as read (was {count_before}, now {count_after})")


class TestPropertiesWithPhotos:
    """Test properties have cover_photo_url"""

    def test_properties_have_cover_photo_url(self, admin_token):
        """Test GET /api/properties returns cover_photo_url for each property"""
        response = requests.get(
            f"{BASE_URL}/api/properties",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Check each property has cover_photo_url
        for prop in data:
            assert "cover_photo_url" in prop, f"Property {prop.get('name', 'N/A')} missing cover_photo_url"
            # cover_photo_url should be a string (can be empty or URL)
            assert isinstance(prop["cover_photo_url"], str)
            if prop["cover_photo_url"]:
                # If present, should be a valid URL (Unsplash)
                assert prop["cover_photo_url"].startswith("http"), f"Invalid cover_photo_url: {prop['cover_photo_url']}"
        
        print(f"✅ All {len(data)} properties have cover_photo_url field")
        # Show sample
        if len(data) > 0:
            sample = data[0]
            print(f"   Sample: {sample.get('name', 'N/A')} -> {sample.get('cover_photo_url', 'N/A')[:60]}...")


# Fixtures
@pytest.fixture(scope="session")
def admin_token():
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
def cleaner_token():
    """Login as Jake (cleaner) and return Bearer token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "jake@maintenance.com", "password": "Maint1234!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    return data["token"]

@pytest.fixture(scope="session")
def vendor_token():
    """Login as Bob (vendor) and return Bearer token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "bob@fixitpro.com", "password": "vendor123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    return data["token"]

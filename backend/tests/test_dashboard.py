"""Dashboard endpoint tests"""
import pytest

class TestDashboard:
    """Test dashboard stats endpoint"""

    def test_dashboard_stats_authenticated(self, base_url, api_client, auth_headers):
        """Test dashboard stats with authentication"""
        response = api_client.get(f"{base_url}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected fields are present
        assert "todays_turnovers" in data
        assert "total_outstanding_maintenance" in data
        assert "urgent_maintenance" in data
        assert "unassigned_maintenance" in data
        assert "blocking_guest" in data
        assert "due_today_maintenance" in data
        assert "properties_at_risk" in data
        assert "pending_inspections" in data
        assert "active_cleaners" in data
        assert "total_properties" in data
        assert "readiness_score" in data
        assert "recent_issues" in data
        assert "todays_turnovers_list" in data
        
        # Verify data types
        assert isinstance(data["todays_turnovers"], int)
        assert isinstance(data["total_outstanding_maintenance"], int)
        assert isinstance(data["readiness_score"], int)
        assert isinstance(data["recent_issues"], list)
        assert isinstance(data["todays_turnovers_list"], list)
        
        # Verify total properties > 0 (seeded data)
        assert data["total_properties"] >= 4

    def test_dashboard_stats_unauthenticated(self, base_url, api_client):
        """Test dashboard stats without authentication"""
        response = api_client.get(f"{base_url}/api/dashboard/stats")
        assert response.status_code == 401

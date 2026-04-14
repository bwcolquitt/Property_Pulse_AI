"""Maintenance/Issues endpoint tests"""
import pytest

class TestMaintenance:
    """Test maintenance issue CRUD operations"""

    def test_list_issues_outstanding(self, base_url, api_client, auth_headers):
        """Test listing outstanding issues (default)"""
        response = api_client.get(f"{base_url}/api/issues", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify seeded data exists
        assert len(data) >= 8
        
        # Verify issue structure
        if len(data) > 0:
            issue = data[0]
            assert "id" in issue
            assert "title" in issue
            assert "status" in issue
            assert "priority" in issue
            assert "property_name" in issue
            assert "assigned_name" in issue
            assert "photo_count" in issue
            # Verify no MongoDB _id
            assert "_id" not in issue
            # Verify status is outstanding
            outstanding_statuses = ["new", "not_started", "assigned", "in_progress", 
                                   "awaiting_approval", "awaiting_parts", "scheduled", 
                                   "blocked", "reopened"]
            assert issue["status"] in outstanding_statuses

    def test_list_issues_filter_by_priority(self, base_url, api_client, auth_headers):
        """Test filtering issues by priority"""
        response = api_client.get(
            f"{base_url}/api/issues?priority=urgent",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned issues should have priority 'urgent'
        for issue in data:
            assert issue["priority"] == "urgent"

    def test_list_issues_filter_unassigned(self, base_url, api_client, auth_headers):
        """Test filtering unassigned issues"""
        response = api_client.get(
            f"{base_url}/api/issues?unassigned=true",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned issues should be unassigned
        for issue in data:
            assert issue.get("assigned_provider_id") is None

    def test_get_issue_by_id(self, base_url, api_client, auth_headers):
        """Test getting a specific issue by ID"""
        # First get list to get an ID
        list_response = api_client.get(f"{base_url}/api/issues", headers=auth_headers)
        issues = list_response.json()
        if len(issues) == 0:
            pytest.skip("No issues available for testing")
        
        issue_id = issues[0]["id"]
        response = api_client.get(
            f"{base_url}/api/issues/{issue_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == issue_id
        assert "property" in data
        assert "comments" in data
        assert "status_history" in data
        assert "media" in data
        assert isinstance(data["comments"], list)
        assert isinstance(data["status_history"], list)

    def test_get_issue_invalid_id(self, base_url, api_client, auth_headers):
        """Test getting issue with invalid ID"""
        response = api_client.get(
            f"{base_url}/api/issues/000000000000000000000000",
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_issues_unauthenticated(self, base_url, api_client):
        """Test issues endpoint without authentication"""
        response = api_client.get(f"{base_url}/api/issues")
        assert response.status_code == 401

"""Turnover endpoint tests"""
import pytest

class TestTurnovers:
    """Test turnover CRUD operations"""

    def test_list_turnovers(self, base_url, api_client, auth_headers):
        """Test listing all turnovers"""
        response = api_client.get(f"{base_url}/api/turnovers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify seeded data exists
        assert len(data) >= 5
        
        # Verify turnover structure
        if len(data) > 0:
            turnover = data[0]
            assert "id" in turnover
            assert "title" in turnover
            assert "status" in turnover
            assert "due_at" in turnover
            assert "property_name" in turnover
            assert "assigned_name" in turnover
            assert "checklist_progress" in turnover
            assert "issues_count" in turnover
            # Verify no MongoDB _id
            assert "_id" not in turnover

    def test_list_turnovers_filter_by_status(self, base_url, api_client, auth_headers):
        """Test filtering turnovers by status"""
        response = api_client.get(
            f"{base_url}/api/turnovers?status=new",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned turnovers should have status 'new'
        for turnover in data:
            assert turnover["status"] == "new"

    def test_get_turnover_by_id(self, base_url, api_client, auth_headers):
        """Test getting a specific turnover by ID"""
        # First get list to get an ID
        list_response = api_client.get(f"{base_url}/api/turnovers", headers=auth_headers)
        turnovers = list_response.json()
        if len(turnovers) == 0:
            pytest.skip("No turnovers available for testing")
        
        turnover_id = turnovers[0]["id"]
        response = api_client.get(
            f"{base_url}/api/turnovers/{turnover_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == turnover_id
        assert "property" in data
        assert "issues" in data
        assert "checklist" in data or data["checklist"] is None
        assert "checklist_items" in data

    def test_get_turnover_invalid_id(self, base_url, api_client, auth_headers):
        """Test getting turnover with invalid ID"""
        response = api_client.get(
            f"{base_url}/api/turnovers/000000000000000000000000",
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_turnovers_unauthenticated(self, base_url, api_client):
        """Test turnovers endpoint without authentication"""
        response = api_client.get(f"{base_url}/api/turnovers")
        assert response.status_code == 401

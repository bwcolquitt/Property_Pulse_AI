"""Marketplace endpoint tests"""
import pytest

class TestMarketplace:
    """Test marketplace provider endpoints"""

    def test_list_providers(self, base_url, api_client, auth_headers):
        """Test listing marketplace providers"""
        response = api_client.get(f"{base_url}/api/marketplace/providers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify seeded data exists
        assert len(data) >= 3
        
        # Verify provider structure
        if len(data) > 0:
            provider = data[0]
            assert "id" in provider
            assert "company_name" in provider
            assert "provider_type" in provider
            assert "services" in provider
            assert "service_areas" in provider
            assert isinstance(provider["services"], list)
            assert isinstance(provider["service_areas"], list)
            # Verify no MongoDB _id
            assert "_id" not in provider

    def test_get_provider_by_id(self, base_url, api_client, auth_headers):
        """Test getting a specific provider by ID"""
        # First get list to get an ID
        list_response = api_client.get(f"{base_url}/api/marketplace/providers", headers=auth_headers)
        providers = list_response.json()
        if len(providers) == 0:
            pytest.skip("No providers available for testing")
        
        provider_id = providers[0]["id"]
        response = api_client.get(
            f"{base_url}/api/marketplace/providers/{provider_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == provider_id
        assert "services" in data
        assert "service_areas" in data
        assert "documents" in data

    def test_get_provider_invalid_id(self, base_url, api_client, auth_headers):
        """Test getting provider with invalid ID"""
        response = api_client.get(
            f"{base_url}/api/marketplace/providers/000000000000000000000000",
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_list_jobs(self, base_url, api_client, auth_headers):
        """Test listing marketplace jobs"""
        response = api_client.get(f"{base_url}/api/marketplace/jobs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_marketplace_unauthenticated(self, base_url, api_client):
        """Test marketplace endpoint without authentication"""
        response = api_client.get(f"{base_url}/api/marketplace/providers")
        assert response.status_code == 401

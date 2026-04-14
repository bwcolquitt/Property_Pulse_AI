"""Authentication endpoint tests"""
import pytest
import requests

class TestAuth:
    """Test authentication flows"""

    def test_health_check(self, base_url, api_client):
        """Test health endpoint is accessible"""
        response = api_client.get(f"{base_url}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "property-pulse"

    def test_login_success_admin(self, base_url, api_client):
        """Test admin login with correct credentials"""
        response = api_client.post(f"{base_url}/api/auth/login", json={
            "email": "admin@example.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "id" in data
        assert data["email"] == "admin@example.com"
        assert data["role"] == "property_manager"
        # Verify cookies are set
        assert "access_token" in response.cookies
        assert "refresh_token" in response.cookies

    def test_login_success_cleaner(self, base_url, api_client):
        """Test cleaner login with correct credentials"""
        response = api_client.post(f"{base_url}/api/auth/login", json={
            "email": "maria@example.com",
            "password": "cleaner123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["email"] == "maria@example.com"
        assert data["role"] == "cleaner"

    def test_login_invalid_email(self, base_url, api_client):
        """Test login with non-existent email"""
        response = api_client.post(f"{base_url}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    def test_login_invalid_password(self, base_url, api_client):
        """Test login with wrong password"""
        response = api_client.post(f"{base_url}/api/auth/login", json={
            "email": "admin@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    def test_get_me_with_token(self, base_url, api_client, admin_token):
        """Test /me endpoint with valid token"""
        response = api_client.get(
            f"{base_url}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@example.com"
        assert "password_hash" not in data
        assert "id" in data

    def test_get_me_without_token(self, base_url):
        """Test /me endpoint without authentication"""
        # Use a fresh session without cookies
        import requests
        response = requests.get(f"{base_url}/api/auth/me")
        assert response.status_code == 401

    def test_logout(self, base_url, api_client):
        """Test logout endpoint"""
        response = api_client.post(f"{base_url}/api/auth/logout")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

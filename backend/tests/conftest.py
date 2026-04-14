import pytest
import requests
import os

@pytest.fixture(scope="session")
def base_url():
    """Get base URL from environment"""
    url = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    if not url:
        pytest.fail("EXPO_PUBLIC_BACKEND_URL not set in environment")
    return url.rstrip('/')

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="session")
def admin_token(base_url, api_client):
    """Login as admin and return token"""
    response = api_client.post(f"{base_url}/api/auth/login", json={
        "email": "admin@example.com",
        "password": "admin123"
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    data = response.json()
    return data.get("token")

@pytest.fixture(scope="session")
def cleaner_token(base_url, api_client):
    """Login as cleaner and return token"""
    response = api_client.post(f"{base_url}/api/auth/login", json={
        "email": "maria@example.com",
        "password": "cleaner123"
    })
    if response.status_code != 200:
        pytest.skip(f"Cleaner login failed: {response.status_code}")
    data = response.json()
    return data.get("token")

@pytest.fixture
def auth_headers(admin_token):
    """Headers with admin auth token"""
    return {"Authorization": f"Bearer {admin_token}"}

from fastapi.testclient import TestClient

from app.auth import AuthedUser, current_user
from app.main import app


def test_health():
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_admin_requires_bearer():
    client = TestClient(app)
    r = client.get("/api/admin/products")
    assert r.status_code == 401


def test_admin_rejects_non_admin():
    app.dependency_overrides[current_user] = lambda: AuthedUser(
        user_id="00000000-0000-0000-0000-000000000001",
        email="user@example.com",
        role="user",
    )
    try:
        client = TestClient(app)
        r = client.get("/api/admin/products")
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()

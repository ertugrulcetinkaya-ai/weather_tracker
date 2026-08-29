from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app, create_app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_app_factory_registers_routes():
    isolated_client = TestClient(create_app(Settings(cors_origins=())))

    response = isolated_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

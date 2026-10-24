import pytest
from fastapi.testclient import TestClient
from sqlalchemy import URL

from tests.conftest import ADMIN_URL
from verdict.main import app


def run_with_database(monkeypatch: pytest.MonkeyPatch, url: URL) -> TestClient:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DEPLOYMENT_MODE", "self_hosted")
    monkeypatch.setenv("DATABASE_URL", url.render_as_string(hide_password=False))
    return TestClient(app)


def test_health_reports_the_database(monkeypatch: pytest.MonkeyPatch) -> None:
    with run_with_database(monkeypatch, ADMIN_URL) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_fails_when_the_database_is_unreachable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with run_with_database(monkeypatch, ADMIN_URL.set(port=1)) as client:
        response = client.get("/health")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "unavailable"}

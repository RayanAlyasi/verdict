from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine

from tests.conftest import ADMIN_URL, api_role_url
from verdict.main import app


@pytest.fixture
def client(api_engine: Engine, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DEPLOYMENT_MODE", "self_hosted")
    monkeypatch.setenv("DATABASE_URL", api_role_url(api_engine.url))
    with TestClient(app) as client:
        yield client


def test_health_reports_the_database(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_fails_when_the_database_is_unreachable(client: TestClient) -> None:
    unreachable = create_engine(
        ADMIN_URL.set(port=1), connect_args={"connect_timeout": 1}
    )
    app.state.engine = unreachable
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "unavailable"}

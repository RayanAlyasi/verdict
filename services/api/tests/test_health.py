import errno
import os
import shutil
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine

from tests.conftest import ADMIN_URL, api_role_url
from verdict.main import app


@pytest.fixture
def storage(tmp_path: Path) -> Path:
    return tmp_path / "storage"


@pytest.fixture
def client(
    api_engine: Engine, storage: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[TestClient]:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DEPLOYMENT_MODE", "self_hosted")
    monkeypatch.setenv("DATABASE_URL", api_role_url(api_engine.url))
    monkeypatch.setenv("STORAGE_LOCAL_PATH", str(storage))
    with TestClient(app) as client:
        yield client


def test_health_reports_the_database_and_storage(
    client: TestClient, storage: Path
) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok", "storage": "ok"}
    assert list(storage.iterdir()) == []


def test_health_fails_when_the_database_is_unreachable(client: TestClient) -> None:
    unreachable = create_engine(
        ADMIN_URL.set(port=1), connect_args={"connect_timeout": 1}
    )
    app.state.engine = unreachable
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json() == {
        "status": "unavailable",
        "database": "unavailable",
        "storage": "ok",
    }


def test_health_fails_when_storage_is_gone(client: TestClient, storage: Path) -> None:
    shutil.rmtree(storage)
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json() == {
        "status": "unavailable",
        "database": "ok",
        "storage": "unavailable",
    }


def test_health_fails_when_storage_is_full(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def full(fd: int) -> None:
        raise OSError(errno.ENOSPC, os.strerror(errno.ENOSPC))

    monkeypatch.setattr(os, "fsync", full)
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json()["storage"] == "unavailable"


def test_a_deployed_api_never_creates_the_storage_folder(
    api_engine: Engine, storage: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("DEPLOYMENT_MODE", "self_hosted")
    monkeypatch.setenv("DATABASE_URL", api_role_url(api_engine.url))
    monkeypatch.setenv("STORAGE_LOCAL_PATH", str(storage))
    with TestClient(app) as client:
        response = client.get("/health")
    assert not storage.exists()
    assert response.status_code == 503
    assert response.json()["storage"] == "unavailable"

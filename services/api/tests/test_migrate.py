import logging

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import URL, text

from tests.conftest import PYPROJECT, api_role_url, as_api_role
from verdict import migrate

HEAD = ScriptDirectory.from_config(Config(toml_file=PYPROJECT)).get_current_head()


@pytest.fixture
def database(roles_database: URL, monkeypatch: pytest.MonkeyPatch) -> URL:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DEPLOYMENT_MODE", "self_hosted")
    monkeypatch.setenv("DATABASE_URL", api_role_url(roles_database))
    return roles_database


def revision(database: URL) -> str | None:
    engine = as_api_role(database)
    with engine.connect() as connection:
        found = connection.execute(text("SELECT version_num FROM alembic_version"))
        value = found.scalar()
    engine.dispose()
    return value


def test_a_new_database_is_migrated_to_the_newest_revision(database: URL) -> None:
    migrate.main()
    assert revision(database) == HEAD


def test_a_rolled_back_version_leaves_a_newer_database_as_it_is(
    database: URL, caplog: pytest.LogCaptureFixture
) -> None:
    migrate.main()
    engine = as_api_role(database)
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE alembic_version SET version_num = 'f0f0f0f0f0f0'")
        )
    engine.dispose()

    with caplog.at_level(logging.WARNING, logger="verdict.migrate"):
        migrate.main()

    assert revision(database) == "f0f0f0f0f0f0"
    assert "revision f0f0f0f0f0f0, which this version doesn't know" in caplog.text

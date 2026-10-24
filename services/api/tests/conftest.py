import os
import uuid
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import psycopg
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import URL, Engine, create_engine, make_url, text

# The superuser connection the tests use to create and drop their own databases. It isn't
# DATABASE_URL, which is the api's own role. CI sets it; locally it's docker compose's superuser.
ADMIN_URL = make_url(
    os.environ.get(
        "TEST_ADMIN_DATABASE_URL",
        "postgresql+psycopg://verdict:verdict@localhost:5432/postgres",
    )
)
API = Path(__file__).resolve().parents[1]
PYPROJECT = API / "pyproject.toml"
ROLES_SQL = API.parents[1] / "config" / "db" / "10-roles.sql"


def libpq(url: URL) -> str:
    return url.set(drivername="postgresql").render_as_string(hide_password=False)


def as_api_role(url: URL, **kwargs: Any) -> Engine:
    """The api's own role, as when deployed; the tests connect as the superuser."""
    return create_engine(url, connect_args={"options": "-c role=verdict_api"}, **kwargs)


def api_role_url(url: URL) -> str:
    """A DATABASE_URL that acts as the api's role, for code that opens its own connections."""
    return url.set(query={"options": "-c role=verdict_api"}).render_as_string(
        hide_password=False
    )


def migrate(
    engine: Engine, pyproject: Path, step: Callable[[Config, str], None], target: str
) -> None:
    # connect(), not begin(): Alembic must own the transaction, as it does when deployed,
    # or a migration's autocommit_block() (CREATE INDEX CONCURRENTLY) fails here.
    with engine.connect() as connection:
        config = Config(toml_file=pyproject)
        config.attributes["connection"] = connection
        step(config, target)


def apply_roles(url: URL) -> None:
    with psycopg.connect(libpq(url), autocommit=True) as connection:
        connection.execute(ROLES_SQL.read_bytes())


@pytest.fixture
def fresh_database() -> Iterator[URL]:
    """A new, empty database, dropped after the test."""
    name = f"verdict_test_{uuid.uuid4().hex[:12]}"
    admin = create_engine(ADMIN_URL, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
    try:
        yield ADMIN_URL.set(database=name)
    finally:
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


@pytest.fixture
def roles_database(fresh_database: URL) -> URL:
    """A new database set up like staging and production, by config/db/10-roles.sql."""
    apply_roles(fresh_database)
    return fresh_database


@pytest.fixture
def api_engine(roles_database: URL) -> Iterator[Engine]:
    """A migrated database reached as the api's role, with room for 20 parallel calls."""
    engine = as_api_role(roles_database, pool_size=25)
    migrate(engine, PYPROJECT, command.upgrade, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"

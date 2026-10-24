import os
import uuid
from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest
from sqlalchemy import URL, create_engine, make_url, text

# The superuser connection the tests use to create and drop their own databases. It isn't
# DATABASE_URL, which is the api's own role. CI sets it; locally it's docker compose's superuser.
ADMIN_URL = make_url(
    os.environ.get(
        "TEST_ADMIN_DATABASE_URL",
        "postgresql+psycopg://verdict:verdict@localhost:5432/postgres",
    )
)
ROLES_SQL = Path(__file__).resolve().parents[3] / "config" / "db" / "10-roles.sql"


def libpq(url: URL) -> str:
    return url.set(drivername="postgresql").render_as_string(hide_password=False)


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

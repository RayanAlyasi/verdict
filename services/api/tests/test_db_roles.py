from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
import pytest
from psycopg import sql
from psycopg.errors import InsufficientPrivilege
from sqlalchemy import URL

from tests.conftest import ADMIN_URL, apply_roles, libpq


@contextmanager
def connect_as(url: URL, role: str) -> Iterator[psycopg.Connection]:
    with psycopg.connect(libpq(url), autocommit=True, options=f"-c role={role}") as c:
        yield c


def test_the_api_role_cannot_reach_better_auths_tables(roles_database: URL) -> None:
    with connect_as(roles_database, "verdict_web") as web:
        web.execute("CREATE TABLE auth.session (id uuid PRIMARY KEY DEFAULT uuidv7())")
    with connect_as(roles_database, "verdict_api") as api:
        with pytest.raises(InsufficientPrivilege):
            api.execute("SELECT * FROM auth.session")
        with pytest.raises(InsufficientPrivilege):
            api.execute("CREATE TABLE auth.stolen (id int)")


def test_the_web_role_cannot_reach_api_tables(roles_database: URL) -> None:
    with connect_as(roles_database, "verdict_api") as api:
        api.execute("CREATE TABLE course (id uuid PRIMARY KEY DEFAULT uuidv7())")
        api.execute("CREATE SCHEMA dbos")
    with connect_as(roles_database, "verdict_web") as web:
        with pytest.raises(InsufficientPrivilege):
            web.execute("SELECT * FROM public.course")
        with pytest.raises(InsufficientPrivilege):
            web.execute("CREATE TABLE public.planted (id int)")


def test_the_api_role_cannot_alter_or_drop_the_database(roles_database: URL) -> None:
    database = sql.Identifier(str(roles_database.database))
    alter = sql.SQL("ALTER DATABASE {} SET default_transaction_read_only = on")
    with (
        connect_as(roles_database, "verdict_api") as api,
        pytest.raises(InsufficientPrivilege),
    ):
        api.execute(alter.format(database))
    # DROP DATABASE can't run while connected to that database, so connect elsewhere.
    with (
        connect_as(ADMIN_URL, "verdict_api") as api,
        pytest.raises(InsufficientPrivilege),
    ):
        api.execute(sql.SQL("DROP DATABASE {}").format(database))


def test_the_roles_file_can_run_again(roles_database: URL) -> None:
    apply_roles(roles_database)

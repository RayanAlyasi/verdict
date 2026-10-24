import shutil
from collections.abc import Callable
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import URL, Connection, Engine, create_engine, text
from sqlalchemy.exc import ProgrammingError

API = Path(__file__).resolve().parents[1]
PYPROJECT = API / "pyproject.toml"

UNINDEXED_FOREIGN_KEYS = text("""
    SELECT t.relname, c.conname
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)]
              @> c.conkey
          AND (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)]
              <@ c.conkey
      )
    ORDER BY 1, 2
""")

# Composite keys (join tables) are allowed; single-column keys must be uuidv7().
PRIMARY_KEYS_WITHOUT_UUIDV7 = text("""
    SELECT t.relname, a.attname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE c.contype = 'p' AND c.connamespace = 'public'::regnamespace
      AND cardinality(c.conkey) = 1
      AND t.relname <> 'alembic_version'
      AND (a.atttypid <> 'uuid'::regtype
           OR pg_get_expr(d.adbin, d.adrelid) IS DISTINCT FROM 'uuidv7()')
    ORDER BY 1, 2
""")


def as_api_role(url: URL) -> Engine:
    """Migrations run as the api's role, as they do when deployed."""
    return create_engine(url, connect_args={"options": "-c role=verdict_api"})


def migrate(
    engine: Engine, pyproject: Path, step: Callable[[Config, str], None], target: str
) -> None:
    # connect(), not begin(): Alembic must own the transaction, as it does when deployed,
    # or a migration's autocommit_block() (CREATE INDEX CONCURRENTLY) fails here.
    with engine.connect() as connection:
        config = Config(toml_file=pyproject)
        config.attributes["connection"] = connection
        step(config, target)


def round_trip(engine: Engine, pyproject: Path) -> None:
    script = ScriptDirectory.from_config(Config(toml_file=pyproject))
    for revision in reversed(list(script.walk_revisions())):
        migrate(engine, pyproject, command.upgrade, revision.revision)
        migrate(engine, pyproject, command.downgrade, "-1")
        migrate(engine, pyproject, command.upgrade, revision.revision)
    migrate(engine, pyproject, command.downgrade, "base")
    migrate(engine, pyproject, command.upgrade, "head")


def convention_breaches(connection: Connection) -> dict[str, list[tuple[str, str]]]:
    return {
        "foreign keys without an index": [
            (row[0], row[1]) for row in connection.execute(UNINDEXED_FOREIGN_KEYS)
        ],
        "primary keys without uuidv7()": [
            (row[0], row[1]) for row in connection.execute(PRIMARY_KEYS_WITHOUT_UUIDV7)
        ],
    }


def test_each_migration_upgrades_downgrades_and_upgrades_again(
    roles_database: URL,
) -> None:
    engine = as_api_role(roles_database)
    round_trip(engine, PYPROJECT)
    with engine.connect() as connection:
        assert convention_breaches(connection) == {
            "foreign keys without an index": [],
            "primary keys without uuidv7()": [],
        }
    engine.dispose()


def test_the_round_trip_catches_a_downgrade_that_undoes_nothing(
    roles_database: URL, tmp_path: Path
) -> None:
    (tmp_path / "migrations" / "versions").mkdir(parents=True)
    shutil.copy(API / "migrations" / "env.py", tmp_path / "migrations")
    (tmp_path / "pyproject.toml").write_text(
        '[tool.alembic]\nscript_location = "%(here)s/migrations"\n'
    )
    (tmp_path / "migrations" / "versions" / "a1_note.py").write_text(
        "from alembic import op\n"
        "revision = 'a1'\n"
        "down_revision = None\n"
        "def upgrade() -> None:\n"
        "    op.execute('CREATE TABLE note (id uuid PRIMARY KEY DEFAULT uuidv7())')\n"
        "def downgrade() -> None:\n"
        "    pass\n"
    )
    engine = as_api_role(roles_database)
    with pytest.raises(ProgrammingError, match="already exists"):
        round_trip(engine, tmp_path / "pyproject.toml")
    engine.dispose()


def test_convention_checks_catch_breaches(fresh_database: URL) -> None:
    engine = create_engine(fresh_database)
    with engine.begin() as connection:
        connection.execute(
            text("""
            CREATE TABLE course (id uuid PRIMARY KEY DEFAULT uuidv7());
            CREATE TABLE topic (id uuid PRIMARY KEY DEFAULT uuidv7(),
                                course_id uuid NOT NULL REFERENCES course);
            CREATE INDEX ON topic (course_id);
            CREATE TABLE source (id bigint PRIMARY KEY,
                                 course_id uuid NOT NULL REFERENCES course);
            CREATE TABLE member (course_id uuid REFERENCES course, user_id uuid,
                                 PRIMARY KEY (course_id, user_id));
            """)
        )
        assert convention_breaches(connection) == {
            "foreign keys without an index": [("source", "source_course_id_fkey")],
            "primary keys without uuidv7()": [("source", "id")],
        }
    engine.dispose()

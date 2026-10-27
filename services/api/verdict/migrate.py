"""Migrate the database to this version's newest revision: python -m verdict.migrate.

The api image runs this before it serves. A rollback starts an older image against a database that a
newer one has already migrated. Migrations are backward compatible (expand and contract), so the
older code runs on that schema, but Alembic refuses to upgrade from a revision it doesn't know. That
case leaves the database as it is.
"""

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Connection, create_engine

from verdict.settings import SettingsError, load_settings

logger = logging.getLogger(__name__)

PYPROJECT = Path(__file__).resolve().parents[1] / "pyproject.toml"


def unknown_revisions(connection: Connection, config: Config) -> set[str]:
    """The database's revisions that this version's migrations don't include."""
    known = {
        revision.revision
        for revision in ScriptDirectory.from_config(config).walk_revisions()
    }
    return set(MigrationContext.configure(connection).get_current_heads()) - known


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")
    try:
        settings = load_settings()
    except SettingsError as error:
        raise SystemExit(str(error)) from None
    config = Config(toml_file=PYPROJECT)
    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        unknown = unknown_revisions(connection, config)
    engine.dispose()
    if unknown:
        logger.warning(
            "The database is at revision %s, which this version doesn't know, so it was "
            "migrated by a newer one: leaving it as it is.",
            ", ".join(sorted(unknown)),
        )
        return
    command.upgrade(config, "head")


if __name__ == "__main__":
    main()

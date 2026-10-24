import importlib
import logging
from pathlib import Path

from alembic import context
from sqlalchemy import Connection, create_engine

import verdict
from verdict.db import Base
from verdict.settings import load_settings

# Autogenerate compares the database with Base.metadata, so every module's models must be
# imported first; otherwise it writes drop_table for the tables of any module it didn't see.
for models in sorted(Path(verdict.__file__).parent.glob("*/models.py")):
    importlib.import_module(f"verdict.{models.parent.name}.models")


def run(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()


# The tests pass in a connection that already acts as the api's database role.
connection = context.config.attributes.get("connection")
if connection is not None:
    run(connection)
else:
    # So deploy logs show each migration that ran.
    logging.basicConfig(format="%(name)s: %(message)s")
    logging.getLogger("alembic").setLevel(logging.INFO)
    engine = create_engine(load_settings().database_url)
    with engine.connect() as connection:
        run(connection)
    engine.dispose()

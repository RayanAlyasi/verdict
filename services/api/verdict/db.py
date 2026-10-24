import uuid
from typing import Annotated

from sqlalchemy import MetaData, text
from sqlalchemy.orm import DeclarativeBase, mapped_column

# Fixed constraint names, so a later migration can alter or drop a constraint by name.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_N_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


# Postgres 18's uuidv7() is time-ordered, so new rows land at the end of the index.
UUIDv7PrimaryKey = Annotated[
    uuid.UUID, mapped_column(primary_key=True, server_default=text("uuidv7()"))
]

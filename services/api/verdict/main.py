import asyncio
import logging
import os
import tempfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from dbos import DBOS
from fastapi import FastAPI, Request, Response
from pydantic import BaseModel
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from verdict import example, workflows
from verdict.settings import load_settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Settings load here, not at import, so the OpenAPI export runs without any configuration.
    settings = load_settings()
    app.state.settings = settings
    # Deployed, the folder is a mounted volume: creating it there would hide a missing mount, and
    # files written to it would vanish with the container.
    if settings.app_env in ("development", "test"):
        settings.storage_local_path.mkdir(parents=True, exist_ok=True)
    # The timeout makes /health answer 503 instead of hanging when the host is unreachable. It stays
    # under the web's 4-second wait for /health, so the web reports the database, not the api.
    app.state.engine = create_engine(
        settings.database_url, pool_pre_ping=True, connect_args={"connect_timeout": 3}
    )
    # In a thread: DBOS's synchronous calls refuse to run inside an event loop.
    await asyncio.to_thread(workflows.launch, settings, executor_id="api", queues=[])
    yield
    await asyncio.to_thread(DBOS.destroy)
    app.state.engine.dispose()


app = FastAPI(
    title="Verdict API",
    lifespan=lifespan,
    # Operation ids from the route function's name, so the generated client reads startExample().
    generate_unique_id_function=lambda route: route.name,
)
# Server-sent events are described with OpenAPI 3.2's itemSchema, so the schema says 3.2 (it is
# otherwise 3.1, which 3.2 includes); tools validating it as 3.1, like the client generator, reject it.
app.openapi_version = "3.2.0"
app.include_router(example.router)


Status = Literal["ok", "unavailable"]


class Health(BaseModel):
    status: Status
    database: Status
    storage: Status


@app.get(
    "/health",
    responses={
        503: {"model": Health, "description": "The database or storage is unavailable"}
    },
)
def health(request: Request, response: Response) -> Health:
    database = _database_status(request.app.state.engine)
    storage = _storage_status(request.app.state.settings.storage_local_path)
    status: Status = "ok" if database == storage == "ok" else "unavailable"
    if status != "ok":
        response.status_code = 503
    return Health(status=status, database=database, storage=storage)


def _database_status(engine: Engine) -> Status:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.warning("Health check: the database is unavailable", exc_info=True)
        return "unavailable"
    return "ok"


def _storage_status(folder: Path) -> Status:
    try:
        # Writing to a file, not just finding the folder: it can exist and still be read-only, or
        # full, and a full disk can still create an empty file.
        with tempfile.NamedTemporaryFile(dir=folder, prefix=".health-") as probe:
            probe.write(b"ok")
            probe.flush()
            os.fsync(probe.fileno())
    except OSError:
        logger.warning("Health check: storage is unavailable", exc_info=True)
        return "unavailable"
    return "ok"

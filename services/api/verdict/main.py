import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Literal

from dbos import DBOS
from fastapi import FastAPI, Request, Response
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from verdict import example, workflows
from verdict.settings import load_settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Settings load here, not at import, so the OpenAPI export runs without any configuration.
    settings = load_settings()
    app.state.settings = settings
    # The timeout makes /health answer 503 instead of hanging when the host is unreachable.
    app.state.engine = create_engine(
        settings.database_url, pool_pre_ping=True, connect_args={"connect_timeout": 5}
    )
    # In a thread: DBOS's synchronous calls refuse to run inside an event loop.
    await asyncio.to_thread(workflows.launch, settings, executor_id="api", queues=[])
    yield
    await asyncio.to_thread(DBOS.destroy)
    app.state.engine.dispose()


app = FastAPI(title="Verdict API", lifespan=lifespan)
app.include_router(example.router)


class Health(BaseModel):
    status: Literal["ok", "unavailable"]
    database: Literal["ok", "unavailable"]


@app.get("/health")
def health(request: Request, response: Response) -> Health:
    try:
        with request.app.state.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.warning("Health check: the database is unavailable", exc_info=True)
        response.status_code = 503
        return Health(status="unavailable", database="unavailable")
    return Health(status="ok", database="ok")

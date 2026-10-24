"""Spec 000's example workflow: two steps on the maintenance queue, progress streamed over SSE.

The first real workflow, in spec 001, replaces it.
"""

import logging
from collections.abc import AsyncIterator
from typing import Annotated

from dbos import DBOS
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.sse import EventSourceResponse
from pydantic import BaseModel

from verdict import workflows

logger = logging.getLogger(__name__)

PROGRESS = "progress"


class Progress(BaseModel):
    step: int
    of: int


class Started(BaseModel):
    workflow_id: str


@DBOS.step()
def prepare() -> None:
    logger.info("Example workflow: step 1 ran")


@DBOS.step()
def finish() -> None:
    logger.info("Example workflow: step 2 ran")


@DBOS.workflow(name="example")
def example(pause_seconds: float) -> None:
    prepare()
    # Streams are stored rows with a NOTIFY on each write, so a late reader still gets every value.
    DBOS.write_stream(PROGRESS, Progress(step=1, of=2).model_dump())
    # A durable sleep: a worker that restarts here sleeps only for what's left.
    DBOS.sleep(pause_seconds)
    finish()
    DBOS.write_stream(PROGRESS, Progress(step=2, of=2).model_dump())
    DBOS.close_stream(PROGRESS)


def _not_in_production(request: Request) -> None:
    # Anyone could start examples; they're for development and staging only.
    if request.app.state.settings.app_env == "production":
        raise HTTPException(status_code=404)


async def _existing_workflow(workflow_id: str) -> str:
    if await DBOS.get_workflow_status_async(workflow_id) is None:
        raise HTTPException(status_code=404)
    return workflow_id


router = APIRouter(
    prefix="/api/v1/examples",
    tags=["examples"],
    dependencies=[Depends(_not_in_production)],
)


@router.post("", status_code=202)
def start_example(
    pause_seconds: Annotated[float, Query(ge=0, le=60)] = 1,
) -> Started:
    handle = workflows.queue("maintenance").enqueue(example, pause_seconds)
    return Started(workflow_id=handle.workflow_id)


@router.get("/{workflow_id}/progress", response_class=EventSourceResponse)
async def example_progress(
    workflow_id: Annotated[str, Depends(_existing_workflow)],
) -> AsyncIterator[Progress]:
    async for value in DBOS.read_stream_async(workflow_id, PROGRESS):
        yield Progress.model_validate(value)

"""Spec 000's example workflow: two steps on the maintenance queue, progress streamed over SSE.

The first real workflow, in spec 001, replaces it.
"""

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Annotated

from dbos import DBOS
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.sse import EventSourceResponse, ServerSentEvent
from pydantic import BaseModel

from verdict import workflows

logger = logging.getLogger(__name__)

PROGRESS = "progress"
# A read waits this long for the next update, then the response ends and the browser reconnects
# with Last-Event-ID, so a stalled workflow never holds a connection open for good.
IDLE_SECONDS = 30
# A NOTIFY wakes the reader at once; this is only the fallback check if one is missed.
FALLBACK_CHECK_SECONDS = 10


class Progress(BaseModel):
    step: int
    of: int


class Ended(BaseModel):
    # DBOS's final status: SUCCESS, ERROR or CANCELLED.
    status: str


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
    # Anyone who can reach the api could start examples, so they stay out of production.
    if request.app.state.settings.app_env == "production":
        raise HTTPException(status_code=404)


async def _example_workflow(workflow_id: str) -> str:
    # Only example runs: other workflows' progress belongs to the students who started them.
    status = await DBOS.get_workflow_status_async(workflow_id)
    if status is None or status.name != "example":
        raise HTTPException(status_code=404)
    return workflow_id


router = APIRouter(
    prefix="/api/v1/examples",
    tags=["examples"],
    dependencies=[Depends(_not_in_production)],
)


@router.post("", status_code=202)
def start_example(
    # Short, because each run holds the maintenance queue, which runs one workflow at a time.
    pause_seconds: Annotated[float, Query(ge=0, le=10)] = 1,
) -> Started:
    handle = workflows.queue("maintenance").enqueue(example, pause_seconds)
    return Started(workflow_id=handle.workflow_id)


@router.get("/{workflow_id}/progress", response_class=EventSourceResponse)
async def example_progress(
    workflow_id: Annotated[str, Depends(_example_workflow)],
    last_event_id: Annotated[int | None, Header()] = None,
) -> AsyncIterator[ServerSentEvent]:
    """`progress` events, then an `end` event with the workflow's final status.

    Event ids are stream offsets, so a browser that reconnects resumes after the last one it saw.
    """
    offset = 0 if last_event_id is None else last_event_id + 1
    updates = DBOS.read_stream_async(
        workflow_id,
        PROGRESS,
        offset=offset,
        polling_interval_sec=FALLBACK_CHECK_SECONDS,
    )
    try:
        while True:
            try:
                async with asyncio.timeout(IDLE_SECONDS):
                    value = await anext(updates)
            except StopAsyncIteration:
                break
            except TimeoutError:
                return
            yield ServerSentEvent(
                id=str(offset), event="progress", data=Progress.model_validate(value)
            )
            offset += 1
    finally:
        await updates.aclose()
    status = await DBOS.get_workflow_status_async(workflow_id)
    yield ServerSentEvent(
        event="end", data=Ended(status=status.status if status else "UNKNOWN")
    )

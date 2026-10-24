"""Durable background work on DBOS (docs/ARCHITECTURE.md): the queues, and starting DBOS."""

import importlib
from collections.abc import Sequence
from pathlib import Path

from dbos import DBOS, Queue

from verdict.settings import Settings

# Workflows from each queue that may run at once across all workers, so adding workers never
# overloads what a queue protects: the server's CPUs for parsing and rendering, and the AI
# providers' rate limits for generation and verification.
# DBOS resumes and runs only work started under the same version. Bump this when a release changes
# a workflow so that a run already in progress couldn't replay its steps, and drain those first.
WORKFLOWS_VERSION = "1"

QUEUES = {
    "ingestion": 2,
    "generation": 8,
    "verification": 8,
    "media": 1,
    "maintenance": 1,
}


def launch(settings: Settings, *, executor_id: str, queues: Sequence[str]) -> None:
    """Start DBOS in this process, running workflows only from `queues`.

    The api lists none: every workflow is enqueued on a named queue, so only workers run them. A
    restarted process recovers the workflows it was running by its `executor_id`, so each worker
    keeps the same one.
    """
    _import_workflows()
    DBOS(
        config={
            "name": "verdict",
            "system_database_url": settings.database_url,
            # DBOS's tables live in the api's database, in a schema of their own.
            "dbos_system_schema": "dbos",
            "executor_id": executor_id,
            "application_version": WORKFLOWS_VERSION,
            # Postgres allows 100 connections, and the api and five workers each hold a pool.
            "sys_db_pool_size": 10,
        }
    )
    DBOS.listen_queues(queues)
    DBOS.launch()
    for name, concurrency in QUEUES.items():
        DBOS.register_queue(name, global_concurrency=concurrency)


def queue(name: str) -> Queue:
    found = DBOS.retrieve_queue(name)
    if found is None:
        raise LookupError(f"No {name} queue: DBOS hasn't launched in this process")
    return found


def _import_workflows() -> None:
    """DBOS finds a workflow by name, so every process imports them all before it launches."""
    import verdict.example  # noqa: F401

    for path in sorted(Path(__file__).parent.glob("*/workflows.py")):
        importlib.import_module(f"verdict.{path.parent.name}.workflows")

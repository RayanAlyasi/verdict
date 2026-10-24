import json
import os
import socket
import subprocess
import sys
import threading
import time
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from typing import Any

import httpx2
import pytest
from dbos import DBOSClient, WorkflowHandle
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from tests.conftest import API, api_role_url
from verdict.main import app
from verdict.worker import STOP_TIMEOUT_SECONDS
from verdict.workflows import QUEUES


class Worker:
    """`python -m verdict.worker maintenance` in its own process, its output collected."""

    def __init__(self, database_url: str) -> None:
        env = {
            "PATH": os.environ["PATH"],
            "APP_ENV": "test",
            "DEPLOYMENT_MODE": "self_hosted",
            "DATABASE_URL": database_url,
            "PYTHONUNBUFFERED": "1",
        }
        self.process = subprocess.Popen(
            [sys.executable, "-m", "verdict.worker", "maintenance"],
            cwd=API,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        self.lines: list[str] = []
        threading.Thread(target=self._collect, daemon=True).start()

    def _collect(self) -> None:
        assert self.process.stdout is not None
        for line in self.process.stdout:
            self.lines.append(line)

    @property
    def output(self) -> str:
        return "".join(self.lines)

    def wait_for(self, text: str, timeout: float = 60) -> None:
        deadline = time.monotonic() + timeout
        while text not in self.output:
            if time.monotonic() > deadline or self.process.poll() is not None:
                raise AssertionError(
                    f"The worker never logged {text!r}:\n{self.output}"
                )
            time.sleep(0.05)


@contextmanager
def worker(database_url: str) -> Iterator[Worker]:
    started = Worker(database_url)
    try:
        started.wait_for("Queue: maintenance")
        yield started
    finally:
        if started.process.poll() is None:
            started.process.terminate()
            started.process.wait(timeout=60)


@contextmanager
def api_server(database_url: str) -> Iterator[str]:
    """The api under uvicorn, so responses really stream (TestClient buffers them)."""
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    env = {
        "PATH": os.environ["PATH"],
        "APP_ENV": "test",
        "DEPLOYMENT_MODE": "self_hosted",
        "DATABASE_URL": database_url,
        "PYTHONUNBUFFERED": "1",
    }
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "verdict.main:app", f"--port={port}"],
        cwd=API,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        assert server.stdout is not None
        for line in server.stdout:
            # Logged once the port is bound; "Application startup complete" comes before that.
            if "Uvicorn running on" in line:
                break
        else:
            raise AssertionError("The api never started")
        yield f"http://127.0.0.1:{port}"
    finally:
        server.terminate()
        server.wait(timeout=60)


def wait_until_done(handle: WorkflowHandle[Any], timeout: float = 60) -> None:
    deadline = time.monotonic() + timeout
    while (status := handle.get_status().status) != "SUCCESS":
        assert time.monotonic() < deadline, f"The workflow is still {status}"
        time.sleep(0.1)


def parse_events(lines: Iterable[str]) -> list[dict[str, Any]]:
    """Each SSE event's fields, with `at`: when it arrived."""
    events: list[dict[str, Any]] = []
    fields: dict[str, Any] = {}
    for line in lines:
        if not line:
            if "data" in fields:
                events.append(fields | {"at": time.monotonic()})
            fields = {}
        elif not line.startswith(":"):
            name, _, value = line.partition(": ")
            fields[name] = json.loads(value) if name == "data" else value
    return events


def read_events(client: TestClient, url: str, **headers: str) -> list[dict[str, Any]]:
    with client.stream("GET", url, headers=headers) as response:
        assert response.headers["content-type"].startswith("text/event-stream")
        return parse_events(response.iter_lines())


def enqueue_example(
    dbos: DBOSClient, pause_seconds: float, queue: str = "maintenance"
) -> WorkflowHandle[None]:
    return dbos.enqueue(
        {"queue_name": queue, "workflow_name": "example"}, pause_seconds
    )


@pytest.fixture
def database_url(api_engine: Engine) -> str:
    return api_role_url(api_engine.url)


@pytest.fixture
def dbos(database_url: str) -> Iterator[DBOSClient]:
    client = DBOSClient(system_database_url=database_url)
    yield client
    client.destroy()


@pytest.fixture
def client(database_url: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DEPLOYMENT_MODE", "self_hosted")
    monkeypatch.setenv("DATABASE_URL", database_url)
    with TestClient(app) as client:
        yield client


def test_the_api_registers_every_queue_with_its_concurrency(
    client: TestClient, api_engine: Engine
) -> None:
    with api_engine.connect() as connection:
        rows = connection.execute(text("SELECT name, concurrency FROM dbos.queues"))
        queues = {name: concurrency for name, concurrency in rows}
    assert queues == QUEUES


def test_a_worker_only_runs_a_known_queue() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "verdict.worker", "everything"],
        cwd=API,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 2
    assert "invalid choice: 'everything'" in result.stderr


def test_workers_and_the_api_leave_other_queues_alone(
    client: TestClient, dbos: DBOSClient, database_url: str
) -> None:
    with worker(database_url):
        elsewhere = enqueue_example(dbos, 0, queue="ingestion")
        here = enqueue_example(dbos, 0)
        wait_until_done(here)
    assert elsewhere.get_status().status == "ENQUEUED"


def test_the_example_streams_live_progress_then_its_final_status(
    database_url: str,
) -> None:
    with worker(database_url), api_server(database_url) as api:
        started = httpx2.post(f"{api}/api/v1/examples", params={"pause_seconds": 2})
        assert started.status_code == 202
        url = f"{api}/api/v1/examples/{started.json()['workflow_id']}/progress"
        with httpx2.stream("GET", url, timeout=60) as response:
            events = parse_events(response.iter_lines())

    assert [(e["event"], e.get("id"), e["data"]) for e in events] == [
        ("progress", "0", {"step": 1, "of": 2}),
        ("progress", "1", {"step": 2, "of": 2}),
        ("end", None, {"status": "SUCCESS"}),
    ]
    # Step 2 came over the open stream after the pause, not replayed from storage.
    assert events[1]["at"] - events[0]["at"] >= 1.5


def test_a_reconnecting_browser_resumes_after_its_last_event(
    client: TestClient, dbos: DBOSClient, database_url: str
) -> None:
    with worker(database_url):
        handle = enqueue_example(dbos, 0)
        wait_until_done(handle)
    url = f"/api/v1/examples/{handle.workflow_id}/progress"

    events = read_events(client, url, **{"Last-Event-ID": "0"})

    assert [(e["event"], e.get("id")) for e in events] == [
        ("progress", "1"),
        ("end", None),
    ]


def test_progress_is_served_only_for_examples(
    client: TestClient, dbos: DBOSClient
) -> None:
    other: WorkflowHandle[None] = dbos.enqueue(
        {"queue_name": "ingestion", "workflow_name": "something-else"}
    )
    assert client.get("/api/v1/examples/no-such-workflow/progress").status_code == 404
    assert (
        client.get(f"/api/v1/examples/{other.workflow_id}/progress").status_code == 404
    )


def test_examples_are_hidden_in_production(
    database_url: str, dbos: DBOSClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DEPLOYMENT_MODE", "self_hosted")
    monkeypatch.setenv("DATABASE_URL", database_url)
    with TestClient(app) as client:
        handle = enqueue_example(dbos, 0, queue="ingestion")
        assert client.post("/api/v1/examples").status_code == 404
        url = f"/api/v1/examples/{handle.workflow_id}/progress"
        assert client.get(url).status_code == 404


def test_a_killed_worker_resumes_the_example_at_step_two(
    dbos: DBOSClient, database_url: str
) -> None:
    with worker(database_url) as first:
        handle = enqueue_example(dbos, 5)
        # The first update is written only once step 1's checkpoint is saved; a kill before
        # that point rightly runs step 1 again.
        next(iter(dbos.read_stream(handle.workflow_id, "progress", timeout_seconds=60)))
        # Mid-pause, as a crash or a lost server would stop it: no chance to clean up.
        first.process.kill()
        first.process.wait()

    with worker(database_url) as second:
        wait_until_done(handle)

    assert "step 1 ran" in first.output
    assert "step 2 ran" not in first.output
    assert "step 1 ran" not in second.output
    assert "step 2 ran" in second.output
    progress = list(dbos.read_stream(handle.workflow_id, "progress"))
    assert progress == [{"step": 1, "of": 2}, {"step": 2, "of": 2}]


def test_a_stopped_worker_leaves_in_time_and_its_workflow_resumes(
    dbos: DBOSClient, database_url: str
) -> None:
    with worker(database_url) as first:
        # Long enough that a worker waiting for the workflow's thread would overrun the limit.
        handle = enqueue_example(dbos, STOP_TIMEOUT_SECONDS + 20)
        next(iter(dbos.read_stream(handle.workflow_id, "progress", timeout_seconds=60)))
        stopping = time.monotonic()
        first.process.terminate()
        first.process.wait(timeout=60)
        # Inside the time a container gets between SIGTERM and SIGKILL.
        assert time.monotonic() - stopping < 30

    with worker(database_url) as second:
        wait_until_done(handle)

    assert "step 1 ran" not in second.output
    assert "step 2 ran" in second.output

import json
import os
import subprocess
import sys
import threading
import time
from collections.abc import Iterator
from contextlib import contextmanager

import pytest
from dbos import DBOSClient, WorkflowHandle
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from tests.conftest import API, api_role_url
from verdict.main import app
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
        yield started
    finally:
        if started.process.poll() is None:
            started.process.terminate()
            started.process.wait(timeout=30)


@pytest.fixture
def database_url(api_engine: Engine) -> str:
    return api_role_url(api_engine.url)


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


def test_the_example_streams_both_steps_over_sse(
    client: TestClient, database_url: str
) -> None:
    with worker(database_url):
        started = client.post("/api/v1/examples", params={"pause_seconds": 0})
        assert started.status_code == 202
        url = f"/api/v1/examples/{started.json()['workflow_id']}/progress"
        with client.stream("GET", url) as response:
            assert response.headers["content-type"].startswith("text/event-stream")
            events = [
                json.loads(line.removeprefix("data: "))
                for line in response.iter_lines()
                if line.startswith("data: ")
            ]

    assert events == [{"step": 1, "of": 2}, {"step": 2, "of": 2}]


def test_progress_for_an_unknown_workflow_is_not_found(client: TestClient) -> None:
    assert client.get("/api/v1/examples/no-such-workflow/progress").status_code == 404


def test_examples_are_hidden_in_production(
    database_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DEPLOYMENT_MODE", "self_hosted")
    monkeypatch.setenv("DATABASE_URL", database_url)
    with TestClient(app) as client:
        assert client.post("/api/v1/examples").status_code == 404


def test_a_killed_worker_resumes_the_example_at_step_two(database_url: str) -> None:
    dbos = DBOSClient(system_database_url=database_url)
    try:
        with worker(database_url) as first:
            first.wait_for("Registered and listening")
            handle: WorkflowHandle[None] = dbos.enqueue(
                {"queue_name": "maintenance", "workflow_name": "example"}, 5
            )
            first.wait_for("step 1 ran")
            # Mid-pause, as a crash or a lost server would stop it: no chance to clean up.
            first.process.kill()
            first.process.wait()

        with worker(database_url) as second:
            second.wait_for("step 2 ran")
            deadline = time.monotonic() + 60
            while (status := handle.get_status().status) != "SUCCESS":
                assert time.monotonic() < deadline, f"The workflow is still {status}"
                time.sleep(0.1)

        assert "step 2 ran" not in first.output
        assert "step 1 ran" not in second.output
        progress = list(dbos.read_stream(handle.workflow_id, "progress"))
        assert progress == [{"step": 1, "of": 2}, {"step": 2, "of": 2}]
    finally:
        dbos.destroy()

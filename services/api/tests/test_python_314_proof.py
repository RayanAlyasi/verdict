"""TEMPORARY, removed before merge: spec 000's proof that every planned dependency imports on 3.14."""

import importlib
import platform
import sys

import pytest

MODULES = [
    "fastapi",
    "uvicorn",
    "uvloop",
    "httptools",
    "pydantic",
    "pydantic_settings",
    "sqlalchemy",
    "alembic",
    "psycopg",
    "dbos",
    "pydantic_ai",
    "pydantic_ai.models.anthropic",
    "pydantic_ai.models.openai",
    "anthropic",
    "openai",
    "opentelemetry.sdk.trace",
    "opentelemetry.exporter.otlp.proto.http.trace_exporter",
    "jwt",
    "cryptography",
    "sympy",
    "pint",
    "pydantic_evals",
    "python_multipart",
    "boto3",
    "sentry_sdk",
    "torch",
    "torchvision",
    "docling.document_converter",
    "httpx2",
    "mypy",
]


def test_runs_on_python_314() -> None:
    print(f"Python {sys.version} on {platform.machine()}")
    assert sys.version_info[:2] == (3, 14)


@pytest.mark.parametrize("name", MODULES)
def test_imports(name: str) -> None:
    importlib.import_module(name)


def test_psycopg_uses_its_binary_build() -> None:
    import psycopg

    assert psycopg.pq.__impl__ == "binary"


def test_torch_is_the_cpu_build() -> None:
    import torch

    assert not torch.cuda.is_available()
    assert "+cpu" in torch.__version__ or platform.system() == "Darwin"

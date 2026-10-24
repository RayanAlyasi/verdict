import os
import subprocess
import sys
from pathlib import Path

import pytest

from verdict.settings import SettingsError, load_settings

API = Path(__file__).resolve().parents[1]
PASSWORD = "do-not-print-me"
VALID = {
    "APP_ENV": "test",
    "DEPLOYMENT_MODE": "hosted",
    "DATABASE_URL": f"postgresql+psycopg://verdict:{PASSWORD}@localhost:1/verdict",
    "AI_DAILY_SPEND_LIMIT_USD": "1",
    "ANTHROPIC_API_KEY": f"sk-ant-{PASSWORD}",
}


def start_api(env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "verdict.main:app",
            "--lifespan=on",
            "--port=0",
        ],
        check=False,
        cwd=API,
        env={"PATH": os.environ["PATH"], **env},
        capture_output=True,
        text=True,
        timeout=30,
    )


@pytest.mark.parametrize("value", [None, ""], ids=["missing", "empty"])
@pytest.mark.parametrize("name", VALID)
def test_the_api_stops_at_startup_without_a_required_setting(
    name: str, value: str | None
) -> None:
    env = {k: v for k, v in VALID.items() if k != name}
    if value is not None:
        env[name] = value
    result = start_api(env)
    assert result.returncode != 0
    assert f"{name} is missing or empty" in result.stderr
    assert PASSWORD not in result.stdout + result.stderr


@pytest.fixture
def environment(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    for name in [*VALID, "AI_PROVIDER"]:
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def test_self_hosted_mode_needs_no_spend_cap(environment: pytest.MonkeyPatch) -> None:
    for name, value in VALID.items():
        environment.setenv(name, value)
    environment.setenv("DEPLOYMENT_MODE", "self_hosted")
    environment.delenv("AI_DAILY_SPEND_LIMIT_USD")
    assert load_settings().ai_daily_spend_limit_usd is None


def test_an_invalid_value_is_named_but_never_shown(
    environment: pytest.MonkeyPatch,
) -> None:
    for name, value in VALID.items():
        environment.setenv(name, value)
    environment.setenv("APP_ENV", PASSWORD)
    environment.setenv("AI_DAILY_SPEND_LIMIT_USD", "-1")
    with pytest.raises(SettingsError) as error:
        load_settings()
    assert "APP_ENV is invalid" in str(error.value)
    assert "AI_DAILY_SPEND_LIMIT_USD is invalid" in str(error.value)
    assert PASSWORD not in str(error.value)


def test_the_fake_provider_runs_only_in_development_and_tests(
    environment: pytest.MonkeyPatch,
) -> None:
    for name, value in VALID.items():
        environment.setenv(name, value)
    environment.setenv("AI_PROVIDER", "fake")
    environment.delenv("ANTHROPIC_API_KEY")
    assert load_settings().ai_provider == "fake"
    environment.setenv("APP_ENV", "staging")
    with pytest.raises(SettingsError, match="AI_PROVIDER is fake"):
        load_settings()


def test_self_hosted_mode_needs_no_platform_key(
    environment: pytest.MonkeyPatch,
) -> None:
    for name, value in VALID.items():
        environment.setenv(name, value)
    environment.setenv("DEPLOYMENT_MODE", "self_hosted")
    environment.delenv("ANTHROPIC_API_KEY")
    assert load_settings().anthropic_api_key is None

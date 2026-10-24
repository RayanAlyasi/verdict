from decimal import Decimal
from typing import Literal

from pydantic import Field, SecretStr, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class SettingsError(Exception):
    pass


class Settings(BaseSettings):
    # An empty variable counts as missing, so a blank secret stops startup instead of being used.
    model_config = SettingsConfigDict(env_ignore_empty=True, frozen=True)

    app_env: Literal["development", "test", "staging", "production"] = Field(
        description="development, test, staging or production"
    )
    deployment_mode: Literal["hosted", "byok", "self_hosted"] = Field(
        description="hosted, byok or self_hosted (see docs/ARCHITECTURE.md)"
    )
    database_url: str = Field(
        description="the api role's postgresql+psycopg:// URL; "
        "docker compose provides one locally (see .env.example)"
    )
    ai_daily_token_limit_per_user: int = Field(
        default=200_000,
        ge=0,
        description="each student's daily AI token limit, for example 200000",
    )
    ai_daily_spend_limit_usd: Decimal | None = Field(
        default=None,
        ge=0,
        description="the platform's daily AI spend cap in US dollars, for example 5",
    )
    ai_provider: Literal["auto", "fake"] = Field(
        default="auto",
        description="auto, or fake for tests (canned answers, no AI provider)",
    )
    anthropic_api_key: SecretStr | None = Field(
        default=None,
        description="the platform's Anthropic API key, from platform.claude.com",
    )


def load_settings() -> Settings:
    """Read settings from the environment, or fail with a message that names each variable.

    The message never includes a value: Pydantic's own errors echo the input, which may be a secret.
    """
    try:
        settings = Settings()
    except ValidationError as error:
        problems = []
        for detail in error.errors():
            name = str(detail["loc"][0])
            if detail["type"] == "missing":
                hint = Settings.model_fields[name].description
                problems.append(
                    f"{name.upper()} is missing or empty: set it to {hint}."
                )
            else:
                problems.append(f"{name.upper()} is invalid: {detail['msg']}.")
        raise SettingsError(_message(problems)) from None
    problems = []
    if settings.deployment_mode == "hosted":
        if settings.ai_daily_spend_limit_usd is None:
            problems.append(
                _missing_in_hosted_mode(
                    "ai_daily_spend_limit_usd", "a cap on AI spending"
                )
            )
        if settings.ai_provider == "auto" and settings.anthropic_api_key is None:
            problems.append(
                _missing_in_hosted_mode("anthropic_api_key", "the platform's AI key")
            )
    if settings.ai_provider == "fake" and settings.app_env not in (
        "development",
        "test",
    ):
        problems.append(
            f"AI_PROVIDER is fake, which gives canned answers: use auto in {settings.app_env}."
        )
    if problems:
        raise SettingsError(_message(problems))
    return settings


def _missing_in_hosted_mode(name: str, why: str) -> str:
    hint = Settings.model_fields[name].description
    return f"{name.upper()} is missing or empty: hosted mode needs {why}. Set it to {hint}."


def _message(problems: list[str]) -> str:
    lines = "\n".join(f"  - {problem}" for problem in problems)
    return (
        "The api can't start until these settings are fixed.\n"
        f"{lines}\n"
        "Locally they come from .env (copy .env.example); deployed, from the environment's "
        "secrets."
    )

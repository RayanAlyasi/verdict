import tomllib
from decimal import Decimal
from enum import StrEnum
from pathlib import Path
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, model_validator

REGISTRY = Path(__file__).with_name("registry.toml")


class Role(StrEnum):
    """What a call is for. Code asks for a role, never a model."""

    EXTRACT = "extract"
    GENERATE = "generate"
    TUTOR = "tutor"
    VERIFY = "verify"
    EMBED = "embed"


class Prices(BaseModel):
    """US dollars per million tokens, for prompts up to `up_to_input_tokens` (None: any size)."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    up_to_input_tokens: int | None = None
    input: Decimal
    cache_write: Decimal
    cache_read: Decimal
    output: Decimal


class ModelInfo(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    context_tokens: int
    max_output_tokens: int
    vision: bool
    structured_output: bool
    # explicit: the prompt marks what to cache (Anthropic); automatic: the provider decides.
    prompt_caching: Literal["explicit", "automatic", "none"]
    batch: bool
    prices: list[Prices]

    @model_validator(mode="after")
    def _prices_cover_every_prompt_size(self) -> Self:
        bounds = [
            t.up_to_input_tokens for t in self.prices[:-1] if t.up_to_input_tokens
        ]
        if (
            not self.prices
            or self.prices[-1].up_to_input_tokens is not None
            or len(bounds) != len(self.prices) - 1
            or bounds != sorted(bounds)
        ):
            raise ValueError(
                "price tiers go from small prompts to large; each has a limit but the last"
            )
        return self

    def prices_for(self, input_tokens: int) -> Prices:
        return next(
            tier
            for tier in self.prices
            if tier.up_to_input_tokens is None
            or input_tokens <= tier.up_to_input_tokens
        )


class Registry(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    roles: dict[Role, str]
    models: dict[str, ModelInfo]

    @model_validator(mode="after")
    def _roles_use_known_models(self) -> Self:
        unknown = sorted(set(self.roles.values()) - set(self.models))
        if unknown:
            raise ValueError(f"roles use models with no entry: {', '.join(unknown)}")
        return self


def load_registry(path: Path = REGISTRY) -> Registry:
    with path.open("rb") as file:
        # Decimal, not float: 0.10 as a float isn't exactly ten cents.
        return Registry.model_validate(tomllib.load(file, parse_float=Decimal))

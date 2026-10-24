from decimal import Decimal
from typing import Any

import pytest
from pydantic import ValidationError

from verdict.ai_gateway.registry import Registry, Role, load_registry

PRICES = {"input": 1, "cache_write": 1, "cache_read": 1, "output": 1}
MODEL = {
    "context_tokens": 1000,
    "max_output_tokens": 100,
    "vision": False,
    "structured_output": True,
    "prompt_caching": "none",
    "batch": False,
    "prices": [PRICES],
}


def test_the_shipped_registry_serves_every_role_but_embed() -> None:
    registry = load_registry()
    assert set(registry.roles) == set(Role) - {Role.EMBED}


def test_prices_are_exact() -> None:
    haiku = load_registry().models["anthropic:claude-haiku-5-5"]
    assert haiku.prices_for(100_000).input == Decimal("0.10")
    assert haiku.prices_for(100_001).input == Decimal("0.50")


@pytest.mark.parametrize(
    ("registry", "problem"),
    [
        ({"roles": {"generate": "nowhere:model"}, "models": {}}, "no entry"),
        (
            {
                "roles": {},
                "models": {
                    "m": MODEL | {"prices": [PRICES | {"up_to_input_tokens": 10}]}
                },
            },
            "the last",
        ),
        (
            {
                "roles": {},
                "models": {
                    "m": MODEL
                    | {
                        "prices": [
                            PRICES | {"up_to_input_tokens": 20},
                            PRICES | {"up_to_input_tokens": 10},
                            PRICES,
                        ]
                    }
                },
            },
            "small prompts to large",
        ),
        ({"roles": {"summarise": "m"}, "models": {"m": MODEL}}, "roles"),
    ],
    ids=["unknown model", "last tier bounded", "tiers out of order", "unknown role"],
)
def test_a_broken_registry_is_refused(registry: dict[str, Any], problem: str) -> None:
    with pytest.raises(ValidationError, match=problem):
        Registry.model_validate(registry)

import uuid

from pydantic import SecretStr

from verdict.settings import Settings


class MissingCredentialError(Exception):
    pass


def resolve_credential(
    settings: Settings, provider: str, user_id: uuid.UUID
) -> SecretStr:
    """The API key for a call made for a student, which depends on who pays (DEPLOYMENT_MODE)."""
    if settings.deployment_mode == "byok":
        # Students' own keys, stored with envelope encryption, arrive in a later spec. The
        # student's id is already part of this interface so that change stays inside this module.
        raise NotImplementedError("Bring-your-own-key mode isn't available yet")
    # hosted uses the platform's keys and self_hosted the server's; both come from the environment.
    keys = {"anthropic": settings.anthropic_api_key}
    key = keys.get(provider)
    if key is None:
        raise MissingCredentialError(
            f"No API key for {provider}: set {provider.upper()}_API_KEY"
        )
    return key

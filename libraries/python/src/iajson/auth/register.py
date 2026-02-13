"""Agent registration helpers for ia.json signed_key authentication.

Implements the four-step registration flow described in the ia.json
specification (Section 5.1):

1. POST registration request to the site's ``register_url``.
2. Site sends a verification code to the agent's ``webhook_url``.
3. Agent echoes the verification code back to the site.
4. Site responds with ``api_key`` and ``secret``.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import httpx

from iajson.exceptions import AuthenticationError, IaJsonError


@dataclass(frozen=True, slots=True)
class AgentInfo:
    """Information about the AI agent sent during registration."""

    name: str
    domain: str
    webhook_url: str
    contact: str
    description: str = ""


@dataclass(frozen=True, slots=True)
class Credentials:
    """Credentials returned by the site after successful registration."""

    api_key: str
    secret: str
    expires_at: str | None = None
    permissions: list[str] = field(default_factory=list)


def register(
    register_url: str,
    agent_info: AgentInfo,
    *,
    timeout: float = 30.0,
) -> dict:
    """Send the initial registration request (step 1).

    Args:
        register_url: The ``auth.signed_key.register_url`` from the
            ia.json file.
        agent_info: Metadata about the AI agent.
        timeout: HTTP request timeout in seconds.

    Returns:
        The parsed JSON response body from the registration endpoint.

    Raises:
        AuthenticationError: If the site rejects the registration.
        IaJsonError: On network or unexpected errors.
    """
    payload = {
        "name": agent_info.name,
        "domain": agent_info.domain,
        "webhook_url": agent_info.webhook_url,
        "contact": agent_info.contact,
    }
    if agent_info.description:
        payload["description"] = agent_info.description

    try:
        response = httpx.post(register_url, json=payload, timeout=timeout)
    except httpx.HTTPError as exc:
        raise IaJsonError(
            f"Registration request failed: {exc}",
            details={"register_url": register_url},
        ) from exc

    if response.status_code >= 400:
        raise AuthenticationError(
            f"Registration rejected (HTTP {response.status_code}): {response.text}",
            status_code=response.status_code,
        )

    return response.json()


async def aregister(
    register_url: str,
    agent_info: AgentInfo,
    *,
    timeout: float = 30.0,
) -> dict:
    """Async variant of :func:`register` (step 1).

    Args:
        register_url: The ``auth.signed_key.register_url`` from the
            ia.json file.
        agent_info: Metadata about the AI agent.
        timeout: HTTP request timeout in seconds.

    Returns:
        The parsed JSON response body from the registration endpoint.

    Raises:
        AuthenticationError: If the site rejects the registration.
        IaJsonError: On network or unexpected errors.
    """
    payload = {
        "name": agent_info.name,
        "domain": agent_info.domain,
        "webhook_url": agent_info.webhook_url,
        "contact": agent_info.contact,
    }
    if agent_info.description:
        payload["description"] = agent_info.description

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                register_url, json=payload, timeout=timeout,
            )
    except httpx.HTTPError as exc:
        raise IaJsonError(
            f"Registration request failed: {exc}",
            details={"register_url": register_url},
        ) from exc

    if response.status_code >= 400:
        raise AuthenticationError(
            f"Registration rejected (HTTP {response.status_code}): {response.text}",
            status_code=response.status_code,
        )

    return response.json()


def verify(
    verify_url: str,
    verification_code: str,
    *,
    timeout: float = 30.0,
) -> Credentials:
    """Send the verification code back to the site (step 3) and parse
    the resulting credentials (step 4).

    Args:
        verify_url: The URL to POST the verification code to.  This is
            typically derived from the ``register_url`` (e.g. replacing
            ``/register`` with ``/verify``), or returned in the step-1
            response.
        verification_code: The code received at the agent's webhook.
        timeout: HTTP request timeout in seconds.

    Returns:
        The :class:`Credentials` issued by the site.

    Raises:
        AuthenticationError: If verification fails.
        IaJsonError: On network or unexpected errors.
    """
    try:
        response = httpx.post(
            verify_url,
            json={"verification_code": verification_code},
            timeout=timeout,
        )
    except httpx.HTTPError as exc:
        raise IaJsonError(
            f"Verification request failed: {exc}",
            details={"verify_url": verify_url},
        ) from exc

    if response.status_code >= 400:
        raise AuthenticationError(
            f"Verification failed (HTTP {response.status_code}): {response.text}",
            error_code="verification_failed",
            status_code=response.status_code,
        )

    data = response.json()
    return Credentials(
        api_key=data["api_key"],
        secret=data["secret"],
        expires_at=data.get("expires_at"),
        permissions=data.get("permissions", []),
    )


async def averify(
    verify_url: str,
    verification_code: str,
    *,
    timeout: float = 30.0,
) -> Credentials:
    """Async variant of :func:`verify` (steps 3 and 4).

    Args:
        verify_url: The URL to POST the verification code to.
        verification_code: The code received at the agent's webhook.
        timeout: HTTP request timeout in seconds.

    Returns:
        The :class:`Credentials` issued by the site.

    Raises:
        AuthenticationError: If verification fails.
        IaJsonError: On network or unexpected errors.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                verify_url,
                json={"verification_code": verification_code},
                timeout=timeout,
            )
    except httpx.HTTPError as exc:
        raise IaJsonError(
            f"Verification request failed: {exc}",
            details={"verify_url": verify_url},
        ) from exc

    if response.status_code >= 400:
        raise AuthenticationError(
            f"Verification failed (HTTP {response.status_code}): {response.text}",
            error_code="verification_failed",
            status_code=response.status_code,
        )

    data = response.json()
    return Credentials(
        api_key=data["api_key"],
        secret=data["secret"],
        expires_at=data.get("expires_at"),
        permissions=data.get("permissions", []),
    )


__all__ = [
    "AgentInfo",
    "Credentials",
    "register",
    "aregister",
    "verify",
    "averify",
]

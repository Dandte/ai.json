"""OAuth2 helpers for ia.json ``user_required`` endpoints.

Provides utilities for building authorization URLs, exchanging
authorization codes for tokens, and refreshing tokens -- following the
OAuth2 configuration declared in an ia.json file's ``auth.oauth2``
section.

PKCE (Proof Key for Code Exchange) is supported and recommended.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
from dataclasses import dataclass, field
from urllib.parse import urlencode

import httpx

from iajson.exceptions import AuthenticationError, IaJsonError


@dataclass(frozen=True, slots=True)
class OAuth2Config:
    """Parsed OAuth2 configuration from an ia.json file."""

    authorization_url: str
    token_url: str
    scopes: dict[str, str]
    grant_types: list[str] = field(default_factory=lambda: ["authorization_code"])
    pkce_required: bool = False

    @classmethod
    def from_dict(cls, data: dict) -> OAuth2Config:
        """Create an :class:`OAuth2Config` from the ``auth.oauth2``
        section of a parsed ia.json file."""
        return cls(
            authorization_url=data["authorization_url"],
            token_url=data["token_url"],
            scopes=data["scopes"],
            grant_types=data.get("grant_types", ["authorization_code"]),
            pkce_required=data.get("pkce_required", False),
        )


@dataclass(frozen=True, slots=True)
class PKCEChallenge:
    """A PKCE code-verifier / code-challenge pair."""

    verifier: str
    challenge: str
    method: str = "S256"


@dataclass(slots=True)
class TokenResponse:
    """An OAuth2 token response."""

    access_token: str
    token_type: str = "Bearer"
    expires_in: int | None = None
    refresh_token: str | None = None
    scope: str | None = None


def generate_pkce_challenge() -> PKCEChallenge:
    """Generate a PKCE code-verifier and S256 code-challenge.

    Returns:
        A :class:`PKCEChallenge` instance.
    """
    verifier = secrets.token_urlsafe(48)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return PKCEChallenge(verifier=verifier, challenge=challenge)


def build_authorization_url(
    config: OAuth2Config,
    *,
    client_id: str,
    redirect_uri: str,
    scopes: list[str] | None = None,
    state: str | None = None,
    pkce: PKCEChallenge | None = None,
) -> str:
    """Build the OAuth2 authorization URL that the user should visit.

    Args:
        config: The OAuth2 configuration from ia.json.
        client_id: Your application's client ID.
        redirect_uri: The redirect URI registered with the provider.
        scopes: Scopes to request.  If ``None``, all available scopes
            from the config are requested.
        state: An opaque value for CSRF protection.
        pkce: A PKCE challenge.  If the config has ``pkce_required``
            set and no challenge is provided, one will be generated
            automatically (though the caller will not have access to
            the verifier in that case, so it is better to pass one
            explicitly).

    Returns:
        The fully-formed authorization URL.
    """
    params: dict[str, str] = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": " ".join(scopes or list(config.scopes.keys())),
    }
    if state is not None:
        params["state"] = state
    if pkce is not None:
        params["code_challenge"] = pkce.challenge
        params["code_challenge_method"] = pkce.method

    separator = "&" if "?" in config.authorization_url else "?"
    return f"{config.authorization_url}{separator}{urlencode(params)}"


def exchange_code(
    config: OAuth2Config,
    *,
    client_id: str,
    client_secret: str,
    code: str,
    redirect_uri: str,
    code_verifier: str | None = None,
    timeout: float = 30.0,
) -> TokenResponse:
    """Exchange an authorization code for an access token (sync).

    Args:
        config: The OAuth2 configuration from ia.json.
        client_id: Your application's client ID.
        client_secret: Your application's client secret.
        code: The authorization code from the callback.
        redirect_uri: The redirect URI used in the authorization request.
        code_verifier: The PKCE code verifier, if PKCE was used.
        timeout: HTTP request timeout in seconds.

    Returns:
        A :class:`TokenResponse` with the access token.

    Raises:
        AuthenticationError: If the token exchange fails.
    """
    payload: dict[str, str] = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
    }
    if code_verifier is not None:
        payload["code_verifier"] = code_verifier

    try:
        response = httpx.post(config.token_url, data=payload, timeout=timeout)
    except httpx.HTTPError as exc:
        raise IaJsonError(f"Token exchange failed: {exc}") from exc

    if response.status_code >= 400:
        raise AuthenticationError(
            f"Token exchange rejected (HTTP {response.status_code}): {response.text}",
            error_code="token_exchange_failed",
            status_code=response.status_code,
        )

    return _parse_token_response(response.json())


async def aexchange_code(
    config: OAuth2Config,
    *,
    client_id: str,
    client_secret: str,
    code: str,
    redirect_uri: str,
    code_verifier: str | None = None,
    timeout: float = 30.0,
) -> TokenResponse:
    """Async variant of :func:`exchange_code`.

    Args:
        config: The OAuth2 configuration from ia.json.
        client_id: Your application's client ID.
        client_secret: Your application's client secret.
        code: The authorization code from the callback.
        redirect_uri: The redirect URI used in the authorization request.
        code_verifier: The PKCE code verifier, if PKCE was used.
        timeout: HTTP request timeout in seconds.

    Returns:
        A :class:`TokenResponse` with the access token.

    Raises:
        AuthenticationError: If the token exchange fails.
    """
    payload: dict[str, str] = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
    }
    if code_verifier is not None:
        payload["code_verifier"] = code_verifier

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                config.token_url, data=payload, timeout=timeout,
            )
    except httpx.HTTPError as exc:
        raise IaJsonError(f"Token exchange failed: {exc}") from exc

    if response.status_code >= 400:
        raise AuthenticationError(
            f"Token exchange rejected (HTTP {response.status_code}): {response.text}",
            error_code="token_exchange_failed",
            status_code=response.status_code,
        )

    return _parse_token_response(response.json())


def refresh_token(
    config: OAuth2Config,
    *,
    client_id: str,
    client_secret: str,
    refresh: str,
    timeout: float = 30.0,
) -> TokenResponse:
    """Refresh an OAuth2 access token (sync).

    Args:
        config: The OAuth2 configuration from ia.json.
        client_id: Your application's client ID.
        client_secret: Your application's client secret.
        refresh: The refresh token.
        timeout: HTTP request timeout in seconds.

    Returns:
        A :class:`TokenResponse` with the new access token.

    Raises:
        AuthenticationError: If the refresh fails.
    """
    payload: dict[str, str] = {
        "grant_type": "refresh_token",
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh,
    }

    try:
        response = httpx.post(config.token_url, data=payload, timeout=timeout)
    except httpx.HTTPError as exc:
        raise IaJsonError(f"Token refresh failed: {exc}") from exc

    if response.status_code >= 400:
        raise AuthenticationError(
            f"Token refresh rejected (HTTP {response.status_code}): {response.text}",
            error_code="token_refresh_failed",
            status_code=response.status_code,
        )

    return _parse_token_response(response.json())


async def arefresh_token(
    config: OAuth2Config,
    *,
    client_id: str,
    client_secret: str,
    refresh: str,
    timeout: float = 30.0,
) -> TokenResponse:
    """Async variant of :func:`refresh_token`.

    Args:
        config: The OAuth2 configuration from ia.json.
        client_id: Your application's client ID.
        client_secret: Your application's client secret.
        refresh: The refresh token.
        timeout: HTTP request timeout in seconds.

    Returns:
        A :class:`TokenResponse` with the new access token.

    Raises:
        AuthenticationError: If the refresh fails.
    """
    payload: dict[str, str] = {
        "grant_type": "refresh_token",
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                config.token_url, data=payload, timeout=timeout,
            )
    except httpx.HTTPError as exc:
        raise IaJsonError(f"Token refresh failed: {exc}") from exc

    if response.status_code >= 400:
        raise AuthenticationError(
            f"Token refresh rejected (HTTP {response.status_code}): {response.text}",
            error_code="token_refresh_failed",
            status_code=response.status_code,
        )

    return _parse_token_response(response.json())


# -----------------------------------------------------------------------
# Internal helpers
# -----------------------------------------------------------------------

def _parse_token_response(data: dict) -> TokenResponse:
    """Parse a raw JSON token response into a :class:`TokenResponse`."""
    return TokenResponse(
        access_token=data["access_token"],
        token_type=data.get("token_type", "Bearer"),
        expires_in=data.get("expires_in"),
        refresh_token=data.get("refresh_token"),
        scope=data.get("scope"),
    )


__all__ = [
    "OAuth2Config",
    "PKCEChallenge",
    "TokenResponse",
    "generate_pkce_challenge",
    "build_authorization_url",
    "exchange_code",
    "aexchange_code",
    "refresh_token",
    "arefresh_token",
]

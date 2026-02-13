"""Authentication and authorization utilities for ia.json.

Sub-modules
-----------
- **signer** -- HMAC request signing (``signed_key`` auth).
- **register** -- Agent registration flow.
- **oauth** -- OAuth2 helpers for ``user_required`` endpoints.
"""

from __future__ import annotations

from iajson.auth.oauth import (
    OAuth2Config,
    PKCEChallenge,
    TokenResponse,
    build_authorization_url,
    exchange_code,
    generate_pkce_challenge,
)
from iajson.auth.register import AgentInfo, Credentials, register, verify
from iajson.auth.signer import create_signed_headers, sign

__all__ = [
    # signer
    "sign",
    "create_signed_headers",
    # register
    "AgentInfo",
    "Credentials",
    "register",
    "verify",
    # oauth
    "OAuth2Config",
    "PKCEChallenge",
    "TokenResponse",
    "generate_pkce_challenge",
    "build_authorization_url",
    "exchange_code",
]

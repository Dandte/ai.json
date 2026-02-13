"""iajson -- Python reference library for consuming ia.json files.

ia.json is the universal standard for AI interaction with websites.
This library provides discovery, authentication, and API invocation
for ia.json-enabled sites.

Quick start::

    from iajson import IaJsonClient

    client = IaJsonClient.discover("techstore.example.com")
    products = client.call("search_products", q="wireless headphones")

Async::

    client = await IaJsonClient.adiscover("techstore.example.com")
    products = await client.acall("search_products", q="wireless headphones")
"""

from __future__ import annotations

from iajson.auth.oauth import (
    OAuth2Config,
    PKCEChallenge,
    TokenResponse,
    build_authorization_url,
    generate_pkce_challenge,
)
from iajson.auth.register import AgentInfo, Credentials
from iajson.auth.signer import create_signed_headers, sign
from iajson.client import Endpoint, IaJsonClient, Parameter, SiteInfo
from iajson.discovery import adiscover, discover
from iajson.exceptions import (
    AuthenticationError,
    DiscoveryError,
    IaJsonError,
    RateLimitError,
)

__version__ = "1.0.0"

__all__ = [
    # Core version
    "__version__",
    # Client
    "IaJsonClient",
    "Endpoint",
    "Parameter",
    "SiteInfo",
    # Discovery
    "discover",
    "adiscover",
    # Auth -- signer
    "sign",
    "create_signed_headers",
    # Auth -- registration
    "AgentInfo",
    "Credentials",
    # Auth -- OAuth2
    "OAuth2Config",
    "PKCEChallenge",
    "TokenResponse",
    "generate_pkce_challenge",
    "build_authorization_url",
    # Exceptions
    "IaJsonError",
    "AuthenticationError",
    "DiscoveryError",
    "RateLimitError",
]

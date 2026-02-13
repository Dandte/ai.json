"""High-level client for consuming ia.json-enabled APIs.

:class:`IaJsonClient` is the primary entry-point for the library.  It
wraps discovery, authentication, request signing, and endpoint
invocation into a single ergonomic interface.

Typical usage::

    from iajson import IaJsonClient

    client = IaJsonClient.discover("techstore.example.com")
    products = client.call("search_products", q="wireless headphones")
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from typing import Any, Literal

import httpx

from iajson.auth.register import AgentInfo, Credentials
from iajson.auth.register import register as _register_agent
from iajson.auth.register import aregister as _aregister_agent
from iajson.auth.register import verify as _verify_agent
from iajson.auth.signer import create_signed_headers
from iajson.discovery import adiscover as _adiscover
from iajson.discovery import discover as _discover
from iajson.exceptions import (
    AuthenticationError,
    IaJsonError,
    RateLimitError,
)


# -----------------------------------------------------------------------
# Data types
# -----------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class Parameter:
    """A single endpoint parameter or body field."""

    name: str
    type: str
    required: bool
    description: str = ""
    default: Any = None
    example: Any = None
    enum: list[str] | None = None
    min: float | None = None
    max: float | None = None
    pattern: str | None = None

    @classmethod
    def from_dict(cls, name: str, data: dict) -> Parameter:
        """Create a :class:`Parameter` from a raw ia.json dict entry."""
        return cls(
            name=name,
            type=data.get("type", "string"),
            required=data.get("required", False),
            description=data.get("description", ""),
            default=data.get("default"),
            example=data.get("example"),
            enum=data.get("enum"),
            min=data.get("min"),
            max=data.get("max"),
            pattern=data.get("pattern"),
        )


@dataclass(frozen=True, slots=True)
class Endpoint:
    """Parsed representation of a single API endpoint."""

    name: str
    method: str
    path: str
    description: str
    level: Literal["public", "protected", "user_required"]
    parameters: list[Parameter] = field(default_factory=list)
    body_fields: list[Parameter] = field(default_factory=list)
    rate_limit: str | None = None
    scopes: list[str] = field(default_factory=list)
    deprecated: bool = False

    @classmethod
    def from_dict(
        cls,
        name: str,
        data: dict,
        level: Literal["public", "protected", "user_required"],
    ) -> Endpoint:
        """Create an :class:`Endpoint` from a raw ia.json dict entry."""
        parameters = [
            Parameter.from_dict(pname, pdata)
            for pname, pdata in (data.get("parameters") or {}).items()
        ]
        body_fields = [
            Parameter.from_dict(pname, pdata)
            for pname, pdata in (data.get("body") or {}).items()
        ]
        return cls(
            name=name,
            method=data["method"],
            path=data["path"],
            description=data["description"],
            level=level,
            parameters=parameters,
            body_fields=body_fields,
            rate_limit=data.get("rate_limit"),
            scopes=data.get("scopes", []),
            deprecated=data.get("deprecated", False),
        )


@dataclass(frozen=True, slots=True)
class SiteInfo:
    """Parsed ``site`` section of an ia.json document."""

    name: str
    type: str
    description: str = ""
    url: str = ""
    logo: str = ""
    currency: str = ""
    language: str = ""
    timezone: str = ""
    contact: str = ""

    @classmethod
    def from_dict(cls, data: dict) -> SiteInfo:
        """Create a :class:`SiteInfo` from the ``site`` section."""
        return cls(
            name=data["name"],
            type=data["type"],
            description=data.get("description", ""),
            url=data.get("url", ""),
            logo=data.get("logo", ""),
            currency=data.get("currency", ""),
            language=data.get("language", ""),
            timezone=data.get("timezone", ""),
            contact=data.get("contact", ""),
        )


# -----------------------------------------------------------------------
# Path-parameter interpolation
# -----------------------------------------------------------------------

_PATH_PARAM_RE = re.compile(r"\{(\w+)\}")


def _resolve_path(path: str, params: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """Substitute ``{name}`` placeholders in *path* with values from
    *params*.  Returns the resolved path and a copy of *params* with
    the consumed keys removed.
    """
    remaining = dict(params)
    def _replacer(match: re.Match) -> str:
        key = match.group(1)
        if key in remaining:
            value = remaining.pop(key)
            return str(value)
        return match.group(0)

    resolved = _PATH_PARAM_RE.sub(_replacer, path)
    return resolved, remaining


# -----------------------------------------------------------------------
# Client
# -----------------------------------------------------------------------

class IaJsonClient:
    """High-level client for a single ia.json-enabled site.

    Instances are usually created via the :meth:`discover` or
    :meth:`adiscover` class methods, which handle fetching and parsing
    the ia.json file automatically.
    """

    def __init__(
        self,
        document: dict,
        *,
        api_key: str | None = None,
        secret: str | None = None,
        access_token: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        """Initialise the client from a parsed ia.json document.

        Args:
            document: The full parsed ia.json document.
            api_key: An API key for ``signed_key`` auth.
            secret: The shared secret for ``signed_key`` auth.
            access_token: An OAuth2 access token for ``user_required``
                endpoints.
            timeout: Default HTTP request timeout in seconds.
        """
        self._document: dict = document
        self._api_key: str | None = api_key
        self._secret: str | None = secret
        self._access_token: str | None = access_token
        self._timeout: float = timeout

        # Parse structural data eagerly.
        self._base_url: str = document["api"]["base_url"]
        self._site: SiteInfo = SiteInfo.from_dict(document["site"])
        self._auth_config: dict = document.get("auth", {})
        self._security_config: dict = document.get("security", {})
        self._capabilities: dict[str, bool] = document.get("capabilities", {})
        self._endpoints: dict[str, Endpoint] = self._parse_endpoints(document)

    # -------------------------------------------------------------------
    # Factory class-methods
    # -------------------------------------------------------------------

    @classmethod
    def discover(
        cls,
        domain: str,
        *,
        api_key: str | None = None,
        secret: str | None = None,
        access_token: str | None = None,
        timeout: float = 30.0,
    ) -> IaJsonClient:
        """Discover and connect to a site's ia.json (synchronous).

        Args:
            domain: The bare domain name (e.g. ``"example.com"``).
            api_key: An optional API key for ``signed_key`` auth.
            secret: An optional shared secret for ``signed_key`` auth.
            access_token: An optional OAuth2 access token.
            timeout: HTTP request timeout in seconds.

        Returns:
            A configured :class:`IaJsonClient` instance.
        """
        document = _discover(domain, timeout=timeout)
        return cls(
            document,
            api_key=api_key,
            secret=secret,
            access_token=access_token,
            timeout=timeout,
        )

    @classmethod
    async def adiscover(
        cls,
        domain: str,
        *,
        api_key: str | None = None,
        secret: str | None = None,
        access_token: str | None = None,
        timeout: float = 30.0,
    ) -> IaJsonClient:
        """Discover and connect to a site's ia.json (asynchronous).

        This is the ``async`` counterpart of :meth:`discover`.

        Args:
            domain: The bare domain name (e.g. ``"example.com"``).
            api_key: An optional API key for ``signed_key`` auth.
            secret: An optional shared secret for ``signed_key`` auth.
            access_token: An optional OAuth2 access token.
            timeout: HTTP request timeout in seconds.

        Returns:
            A configured :class:`IaJsonClient` instance.
        """
        document = await _adiscover(domain, timeout=timeout)
        return cls(
            document,
            api_key=api_key,
            secret=secret,
            access_token=access_token,
            timeout=timeout,
        )

    # -------------------------------------------------------------------
    # Public properties
    # -------------------------------------------------------------------

    @property
    def document(self) -> dict:
        """The raw ia.json document."""
        return self._document

    @property
    def site(self) -> SiteInfo:
        """Parsed site metadata."""
        return self._site

    @property
    def base_url(self) -> str:
        """The API base URL."""
        return self._base_url

    @property
    def capabilities(self) -> dict[str, bool]:
        """The capabilities flags from the ia.json file."""
        return dict(self._capabilities)

    @property
    def version(self) -> str:
        """The ia.json specification version declared by the site."""
        return self._document["version"]

    # -------------------------------------------------------------------
    # Endpoint introspection
    # -------------------------------------------------------------------

    def get_endpoints(
        self,
        level: str | None = None,
    ) -> list[Endpoint]:
        """Return the list of available endpoints.

        Args:
            level: If provided, only return endpoints at this access
                level (``"public"``, ``"protected"``, or
                ``"user_required"``).

        Returns:
            A list of :class:`Endpoint` objects.
        """
        if level is not None:
            return [ep for ep in self._endpoints.values() if ep.level == level]
        return list(self._endpoints.values())

    def get_endpoint(self, name: str) -> Endpoint:
        """Look up a single endpoint by name.

        Args:
            name: The endpoint name (e.g. ``"search_products"``).

        Returns:
            The :class:`Endpoint` object.

        Raises:
            IaJsonError: If the endpoint name is not found.
        """
        try:
            return self._endpoints[name]
        except KeyError:
            available = ", ".join(sorted(self._endpoints.keys()))
            raise IaJsonError(
                f"Unknown endpoint '{name}'. Available endpoints: {available}"
            )

    # -------------------------------------------------------------------
    # Authentication helpers
    # -------------------------------------------------------------------

    def set_credentials(
        self,
        api_key: str,
        secret: str,
    ) -> None:
        """Set or replace the ``signed_key`` credentials.

        Args:
            api_key: The API key.
            secret: The shared secret.
        """
        self._api_key = api_key
        self._secret = secret

    def set_access_token(self, token: str) -> None:
        """Set or replace the OAuth2 access token.

        Args:
            token: The bearer access token.
        """
        self._access_token = token

    def register(
        self,
        agent_info: AgentInfo,
    ) -> Credentials:
        """Register this agent with the site (synchronous).

        This sends the initial registration request to the site's
        ``auth.signed_key.register_url``.  After calling this method
        the agent must handle the webhook verification callback and then
        call :meth:`complete_registration` with the verification code.

        Args:
            agent_info: Metadata about the AI agent.

        Returns:
            Intermediate response data.  The ``Credentials`` are fully
            populated only after :meth:`complete_registration`.

        Raises:
            IaJsonError: If no ``signed_key`` auth is configured.
            AuthenticationError: If registration is rejected.
        """
        signed_key_config = self._auth_config.get("signed_key")
        if not signed_key_config:
            raise IaJsonError(
                "This site does not support signed_key authentication"
            )
        register_url: str = signed_key_config["register_url"]
        _register_agent(register_url, agent_info, timeout=self._timeout)

        # The verification code arrives asynchronously via webhook.
        # Return a placeholder; callers use complete_registration() next.
        return Credentials(api_key="", secret="")

    def complete_registration(
        self,
        verification_code: str,
        verify_url: str | None = None,
    ) -> Credentials:
        """Complete registration by submitting the verification code.

        Args:
            verification_code: The code received at the agent's webhook.
            verify_url: The verification URL.  If ``None``, it is
                derived from the ``register_url`` by replacing
                ``/register`` with ``/verify``.

        Returns:
            The :class:`Credentials` issued by the site.  The
            credentials are also stored on the client automatically.
        """
        if verify_url is None:
            register_url = self._auth_config["signed_key"]["register_url"]
            verify_url = register_url.replace("/register", "/verify")

        creds = _verify_agent(verify_url, verification_code, timeout=self._timeout)
        self._api_key = creds.api_key
        self._secret = creds.secret
        return creds

    def sign(self, body: str = "") -> tuple[str, int]:
        """Compute a request signature for *body*.

        Args:
            body: The raw request body.  Use an empty string for GET
                requests.

        Returns:
            A ``(signature, timestamp)`` tuple.

        Raises:
            IaJsonError: If no credentials are configured.
        """
        if not self._secret:
            raise IaJsonError("No secret configured; call set_credentials() first")

        signed_key_config = self._auth_config.get("signed_key", {})
        algorithm = signed_key_config.get("algorithm", "sha256")
        prefix = signed_key_config.get("header_prefix", "X-IA-")

        ts = int(time.time())
        headers = create_signed_headers(
            self._api_key or "",
            self._secret,
            body,
            prefix=prefix,
            algorithm=algorithm,
            timestamp=ts,
        )
        signature = headers[f"{prefix}Signature"]
        return signature, ts

    # -------------------------------------------------------------------
    # API call
    # -------------------------------------------------------------------

    def call(
        self,
        endpoint_name: str,
        *,
        access_token: str | None = None,
        **params: Any,
    ) -> dict:
        """Invoke an API endpoint (synchronous).

        Path parameters are extracted from *params* automatically.
        Remaining parameters are sent as query-string parameters for GET
        requests or as JSON body fields for POST/PUT/PATCH/DELETE.

        Args:
            endpoint_name: The endpoint name as declared in the ia.json
                file (e.g. ``"search_products"``).
            access_token: An optional per-request OAuth2 access token
                that overrides the client-level token.
            **params: Keyword arguments mapped to endpoint parameters /
                body fields.

        Returns:
            The parsed JSON response body.

        Raises:
            IaJsonError: If the endpoint is unknown or parameters are
                invalid.
            AuthenticationError: If the server rejects the credentials.
            RateLimitError: If the rate limit is exceeded.
        """
        endpoint = self.get_endpoint(endpoint_name)
        url, headers, request_kwargs = self._prepare_request(
            endpoint, params, access_token=access_token,
        )

        with httpx.Client(timeout=self._timeout) as http:
            response = http.request(endpoint.method, url, headers=headers, **request_kwargs)

        return self._handle_response(response)

    async def acall(
        self,
        endpoint_name: str,
        *,
        access_token: str | None = None,
        **params: Any,
    ) -> dict:
        """Invoke an API endpoint (asynchronous).

        Async counterpart of :meth:`call`.

        Args:
            endpoint_name: The endpoint name.
            access_token: An optional per-request OAuth2 access token.
            **params: Endpoint parameters / body fields.

        Returns:
            The parsed JSON response body.
        """
        endpoint = self.get_endpoint(endpoint_name)
        url, headers, request_kwargs = self._prepare_request(
            endpoint, params, access_token=access_token,
        )

        async with httpx.AsyncClient(timeout=self._timeout) as http:
            response = await http.request(
                endpoint.method, url, headers=headers, **request_kwargs,
            )

        return self._handle_response(response)

    # -------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------

    @staticmethod
    def _parse_endpoints(document: dict) -> dict[str, Endpoint]:
        """Parse all endpoints from a raw ia.json document into a flat
        name-keyed dictionary."""
        endpoints: dict[str, Endpoint] = {}
        api = document["api"]
        for level in ("public", "protected", "user_required"):
            group = api.get(level)
            if not group:
                continue
            for ep_name, ep_data in group.items():
                endpoints[ep_name] = Endpoint.from_dict(ep_name, ep_data, level)  # type: ignore[arg-type]
        return endpoints

    def _prepare_request(
        self,
        endpoint: Endpoint,
        params: dict[str, Any],
        *,
        access_token: str | None = None,
    ) -> tuple[str, dict[str, str], dict[str, Any]]:
        """Build the URL, headers, and ``httpx`` request kwargs for an
        endpoint call.

        Returns:
            A ``(url, headers, request_kwargs)`` tuple.
        """
        # Resolve path parameters.
        resolved_path, remaining = _resolve_path(endpoint.path, params)
        url = f"{self._base_url}{resolved_path}"

        # Build request body / query params.
        request_kwargs: dict[str, Any] = {}
        body_str = ""
        if endpoint.method in ("POST", "PUT", "PATCH", "DELETE") and remaining:
            body_str = json.dumps(remaining, separators=(",", ":"))
            request_kwargs["content"] = body_str
            request_kwargs["headers"] = {"Content-Type": "application/json"}
        elif remaining:
            request_kwargs["params"] = remaining

        # Authentication headers.
        headers: dict[str, str] = {}

        if endpoint.level in ("protected", "user_required"):
            # signed_key auth
            if self._api_key and self._secret:
                signed_key_config = self._auth_config.get("signed_key", {})
                algorithm = signed_key_config.get("algorithm", "sha256")
                prefix = signed_key_config.get("header_prefix", "X-IA-")
                headers.update(
                    create_signed_headers(
                        self._api_key,
                        self._secret,
                        body_str,
                        prefix=prefix,
                        algorithm=algorithm,
                    )
                )

        if endpoint.level == "user_required":
            token = access_token or self._access_token
            if token:
                headers["Authorization"] = f"Bearer {token}"

        return url, headers, request_kwargs

    @staticmethod
    def _handle_response(response: httpx.Response) -> dict:
        """Process an HTTP response, raising typed exceptions for error
        status codes.

        Returns:
            The parsed JSON response body.
        """
        if response.status_code == 429:
            retry_after_raw = response.headers.get("Retry-After")
            retry_after: float | None = None
            if retry_after_raw is not None:
                try:
                    retry_after = float(retry_after_raw)
                except ValueError:
                    pass
            raise RateLimitError(
                f"Rate limit exceeded: {response.text}",
                retry_after=retry_after,
            )

        if response.status_code in (401, 403):
            error_code: str | None = None
            try:
                error_body = response.json()
                error_code = error_body.get("error", {}).get("code")
            except (ValueError, AttributeError):
                pass
            raise AuthenticationError(
                f"Authentication failed (HTTP {response.status_code}): {response.text}",
                error_code=error_code,
                status_code=response.status_code,
            )

        if response.status_code >= 400:
            raise IaJsonError(
                f"API error (HTTP {response.status_code}): {response.text}",
                details={"status_code": response.status_code},
            )

        if not response.content:
            return {}

        return response.json()

    def __repr__(self) -> str:
        return (
            f"<IaJsonClient site={self._site.name!r} "
            f"base_url={self._base_url!r} "
            f"endpoints={len(self._endpoints)}>"
        )


__all__ = [
    "Endpoint",
    "IaJsonClient",
    "Parameter",
    "SiteInfo",
]

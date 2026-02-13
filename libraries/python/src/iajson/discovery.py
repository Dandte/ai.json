"""ia.json file discovery.

Implements the discovery algorithm from the ia.json specification
(Section 6.1):

1. Attempt to fetch ``https://{domain}/ia.json``
2. If not found (404), attempt ``https://{domain}/.well-known/ia.json``
3. If not found, the site does not support ia.json

Both synchronous and asynchronous variants are provided.
"""

from __future__ import annotations

import httpx

from iajson.exceptions import DiscoveryError

#: Maximum accepted file size (1 MB as recommended by the spec).
MAX_FILE_SIZE: int = 1_048_576

#: Paths to probe, in priority order.
_DISCOVERY_PATHS: tuple[str, ...] = (
    "/ia.json",
    "/.well-known/ia.json",
)


def _validate_document(data: dict, *, domain: str) -> dict:
    """Run minimal structural validation on a parsed ia.json document.

    A full JSON-Schema validation is deliberately not performed here to
    keep the library lightweight.  This function ensures the required
    top-level keys exist and the major version is supported.

    Args:
        data: The parsed JSON document.
        domain: The domain the document was fetched from (for error
            context).

    Returns:
        The validated document (unchanged).

    Raises:
        DiscoveryError: If the document is missing required fields or
            has an unsupported major version.
    """
    for key in ("version", "site", "api"):
        if key not in data:
            raise DiscoveryError(
                f"ia.json from {domain} is missing required field '{key}'",
                domain=domain,
            )

    version: str = data["version"]
    try:
        major = int(version.split(".")[0])
    except (ValueError, IndexError):
        raise DiscoveryError(
            f"ia.json from {domain} has invalid version '{version}'",
            domain=domain,
        )

    if major != 1:
        raise DiscoveryError(
            f"Unsupported ia.json major version {major} (expected 1)",
            domain=domain,
        )

    return data


def discover(domain: str, *, timeout: float = 15.0) -> dict:
    """Fetch and parse the ia.json file for *domain* (synchronous).

    Args:
        domain: The bare domain name (e.g. ``"example.com"``).
        timeout: HTTP request timeout in seconds.

    Returns:
        The parsed ia.json document as a dictionary.

    Raises:
        DiscoveryError: If the ia.json file cannot be found or is
            invalid.
    """
    last_error: Exception | None = None

    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        for path in _DISCOVERY_PATHS:
            url = f"https://{domain}{path}"
            try:
                response = client.get(url)
            except httpx.HTTPError as exc:
                last_error = exc
                continue

            if response.status_code == 404:
                continue

            if response.status_code >= 400:
                raise DiscoveryError(
                    f"Failed to fetch {url}: HTTP {response.status_code}",
                    domain=domain,
                    status_code=response.status_code,
                )

            if len(response.content) > MAX_FILE_SIZE:
                raise DiscoveryError(
                    f"ia.json from {domain} exceeds maximum file size "
                    f"({len(response.content)} bytes > {MAX_FILE_SIZE})",
                    domain=domain,
                )

            try:
                data = response.json()
            except ValueError as exc:
                raise DiscoveryError(
                    f"ia.json from {domain} is not valid JSON: {exc}",
                    domain=domain,
                ) from exc

            return _validate_document(data, domain=domain)

    # Neither path returned a usable document.
    if last_error is not None:
        raise DiscoveryError(
            f"Failed to discover ia.json for {domain}: {last_error}",
            domain=domain,
        ) from last_error

    raise DiscoveryError(
        f"No ia.json file found for {domain}",
        domain=domain,
        status_code=404,
    )


async def adiscover(domain: str, *, timeout: float = 15.0) -> dict:
    """Fetch and parse the ia.json file for *domain* (asynchronous).

    This is the ``async`` counterpart of :func:`discover`.

    Args:
        domain: The bare domain name (e.g. ``"example.com"``).
        timeout: HTTP request timeout in seconds.

    Returns:
        The parsed ia.json document as a dictionary.

    Raises:
        DiscoveryError: If the ia.json file cannot be found or is
            invalid.
    """
    last_error: Exception | None = None

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        for path in _DISCOVERY_PATHS:
            url = f"https://{domain}{path}"
            try:
                response = await client.get(url)
            except httpx.HTTPError as exc:
                last_error = exc
                continue

            if response.status_code == 404:
                continue

            if response.status_code >= 400:
                raise DiscoveryError(
                    f"Failed to fetch {url}: HTTP {response.status_code}",
                    domain=domain,
                    status_code=response.status_code,
                )

            if len(response.content) > MAX_FILE_SIZE:
                raise DiscoveryError(
                    f"ia.json from {domain} exceeds maximum file size "
                    f"({len(response.content)} bytes > {MAX_FILE_SIZE})",
                    domain=domain,
                )

            try:
                data = response.json()
            except ValueError as exc:
                raise DiscoveryError(
                    f"ia.json from {domain} is not valid JSON: {exc}",
                    domain=domain,
                ) from exc

            return _validate_document(data, domain=domain)

    if last_error is not None:
        raise DiscoveryError(
            f"Failed to discover ia.json for {domain}: {last_error}",
            domain=domain,
        ) from last_error

    raise DiscoveryError(
        f"No ia.json file found for {domain}",
        domain=domain,
        status_code=404,
    )


__all__ = [
    "discover",
    "adiscover",
]

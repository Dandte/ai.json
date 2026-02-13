"""Request signing utilities for ia.json signed_key authentication.

Implements the HMAC-based request signing algorithm defined in the
ia.json specification (Section 5.2).

Signing string format::

    {timestamp}.{request_body}

For GET requests with no body the signing string is::

    {timestamp}.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from typing import Literal


def sign(
    secret: str,
    timestamp: int,
    body: str,
    *,
    algorithm: Literal["sha256", "sha512"] = "sha256",
) -> str:
    """Compute the HMAC signature for a request.

    Args:
        secret: The shared secret issued during registration.
        timestamp: Unix timestamp in seconds.
        body: The raw request body string.  Use an empty string for GET
            requests with no body.
        algorithm: The HMAC algorithm to use (``"sha256"`` or ``"sha512"``).

    Returns:
        The hex-encoded HMAC signature.
    """
    hash_func = hashlib.sha256 if algorithm == "sha256" else hashlib.sha512
    signing_string = f"{timestamp}.{body}"
    return hmac.new(
        secret.encode("utf-8"),
        signing_string.encode("utf-8"),
        hash_func,
    ).hexdigest()


def create_signed_headers(
    api_key: str,
    secret: str,
    body: str,
    *,
    prefix: str = "X-IA-",
    algorithm: Literal["sha256", "sha512"] = "sha256",
    timestamp: int | None = None,
) -> dict[str, str]:
    """Build the full set of authentication headers for a signed request.

    This is the primary helper that calling code should use.  It obtains
    the current timestamp (or uses the one provided), computes the HMAC
    signature, and returns a dictionary of headers ready to be merged
    into an HTTP request.

    Args:
        api_key: The API key issued during registration.
        secret: The shared secret issued during registration.
        body: The raw request body string.  Use an empty string for GET
            requests with no body.
        prefix: The header prefix declared in the ia.json ``auth.signed_key``
            section.  Defaults to ``"X-IA-"``.
        algorithm: The HMAC algorithm to use (``"sha256"`` or ``"sha512"``).
        timestamp: Optional explicit Unix timestamp.  If ``None``, the
            current time is used.

    Returns:
        A dictionary with three headers: ``{prefix}Key``,
        ``{prefix}Signature``, and ``{prefix}Timestamp``.
    """
    ts = timestamp if timestamp is not None else int(time.time())
    signature = sign(secret, ts, body, algorithm=algorithm)
    return {
        f"{prefix}Key": api_key,
        f"{prefix}Signature": signature,
        f"{prefix}Timestamp": str(ts),
    }


def verify_signature(
    secret: str,
    timestamp: int,
    body: str,
    expected_signature: str,
    *,
    algorithm: Literal["sha256", "sha512"] = "sha256",
    max_age_seconds: int = 60,
) -> bool:
    """Verify an incoming request signature (server-side helper).

    This is provided as a convenience for sites implementing the ia.json
    spec.  It checks both the timestamp freshness and the signature
    validity.

    Args:
        secret: The shared secret for the agent.
        timestamp: The timestamp from the request header.
        body: The raw request body.
        expected_signature: The signature from the request header.
        algorithm: The HMAC algorithm.
        max_age_seconds: Maximum acceptable age of the timestamp.

    Returns:
        ``True`` if the signature is valid and the timestamp is fresh.
    """
    now = int(time.time())
    if abs(now - timestamp) > max_age_seconds:
        return False
    computed = sign(secret, timestamp, body, algorithm=algorithm)
    return hmac.compare_digest(computed, expected_signature)


__all__ = [
    "sign",
    "create_signed_headers",
    "verify_signature",
]

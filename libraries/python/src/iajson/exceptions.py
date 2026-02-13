"""Custom exceptions for the iajson library."""

from __future__ import annotations


class IaJsonError(Exception):
    """Base exception for all iajson errors."""

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class DiscoveryError(IaJsonError):
    """Raised when ia.json discovery fails.

    This covers failures such as the file not being found at the expected
    locations, network errors during fetch, invalid JSON, or schema
    validation problems.
    """

    def __init__(
        self,
        message: str,
        *,
        domain: str | None = None,
        status_code: int | None = None,
        details: dict | None = None,
    ) -> None:
        super().__init__(message, details=details)
        self.domain = domain
        self.status_code = status_code


class AuthenticationError(IaJsonError):
    """Raised when authentication or authorization fails.

    Covers invalid API keys, expired timestamps, bad signatures, and
    OAuth2 token errors.
    """

    def __init__(
        self,
        message: str,
        *,
        error_code: str | None = None,
        status_code: int | None = None,
        details: dict | None = None,
    ) -> None:
        super().__init__(message, details=details)
        self.error_code = error_code
        self.status_code = status_code


class RateLimitError(IaJsonError):
    """Raised when a rate limit is exceeded (HTTP 429).

    The ``retry_after`` attribute contains the number of seconds to wait
    before retrying, if the server provided a ``Retry-After`` header.
    """

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        *,
        retry_after: float | None = None,
        details: dict | None = None,
    ) -> None:
        super().__init__(message, details=details)
        self.retry_after = retry_after


__all__ = [
    "IaJsonError",
    "AuthenticationError",
    "DiscoveryError",
    "RateLimitError",
]

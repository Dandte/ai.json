// =============================================================================
// Custom error classes for the ia.json client library
// =============================================================================

/**
 * Base error class for all ia.json client errors.
 * All other error classes in this library extend from this.
 */
export class IaJsonError extends Error {
  /** HTTP status code, if the error originated from an HTTP response */
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'IaJsonError';
    this.statusCode = statusCode;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when authentication fails. This includes invalid API keys,
 * bad signatures, expired credentials, and failed registrations.
 */
export class AuthenticationError extends IaJsonError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode ?? 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Thrown when a request is rejected due to rate limiting.
 * The `retryAfter` property indicates how many seconds to wait before retrying,
 * if the server provided that information.
 */
export class RateLimitError extends IaJsonError {
  /** Seconds to wait before retrying, from the Retry-After header */
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Thrown when discovery of an ia.json file fails. This includes network errors,
 * invalid JSON, schema validation failures, and missing ia.json at both
 * standard locations (/ia.json and /.well-known/ia.json).
 */
export class DiscoveryError extends IaJsonError {
  /** The domain that was being discovered */
  public readonly domain?: string;

  constructor(message: string, domain?: string, statusCode?: number) {
    super(message, statusCode);
    this.name = 'DiscoveryError';
    this.domain = domain;
  }
}

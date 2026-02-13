// =============================================================================
// Request signing using HMAC-SHA256 (node:crypto)
// =============================================================================

import { createHmac } from 'node:crypto';

/**
 * Compute an HMAC-SHA256 hex signature for a request.
 *
 * @param secret    - The signing secret obtained during agent registration
 * @param timestamp - Unix timestamp in seconds (integer)
 * @param body      - The request body string (use empty string for GET requests)
 * @returns Hex-encoded HMAC-SHA256 signature
 *
 * @example
 * ```ts
 * const sig = sign('my-secret', Math.floor(Date.now() / 1000), '{"key":"value"}');
 * ```
 */
export function sign(secret: string, timestamp: number, body: string): string {
  const payload = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Create the full set of signed authentication headers for a request.
 *
 * The generated headers follow the ia.json signed_key convention:
 *   - `{prefix}Key`       : The agent's API key
 *   - `{prefix}Timestamp` : Unix timestamp (seconds) when the request was signed
 *   - `{prefix}Signature` : HMAC-SHA256 signature of `{timestamp}.{body}`
 *
 * @param apiKey  - The agent's API key
 * @param secret  - The signing secret
 * @param body    - The request body string (use empty string for GET requests)
 * @param prefix  - Header name prefix (default: "X-IA-")
 * @returns Object with the three authentication headers
 *
 * @example
 * ```ts
 * const headers = createSignedHeaders('ak_123', 'secret', '{}', 'X-IA-');
 * // {
 * //   "X-IA-Key": "ak_123",
 * //   "X-IA-Timestamp": "1707750000",
 * //   "X-IA-Signature": "a1b2c3..."
 * // }
 * ```
 */
export function createSignedHeaders(
  apiKey: string,
  secret: string,
  body: string,
  prefix: string = 'X-IA-',
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign(secret, timestamp, body);

  return {
    [`${prefix}Key`]: apiKey,
    [`${prefix}Timestamp`]: String(timestamp),
    [`${prefix}Signature`]: signature,
  };
}

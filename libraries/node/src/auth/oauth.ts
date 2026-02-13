// =============================================================================
// OAuth2 helpers for ia.json user_required endpoints
// =============================================================================

import type { OAuth2Auth, TokenResponse } from '../types.js';
import { AuthenticationError } from '../errors.js';

/**
 * Build the OAuth2 authorization URL that the user should be redirected to.
 *
 * @param config      - OAuth2 configuration from `auth.oauth2`
 * @param clientId    - The OAuth2 client ID for your application
 * @param redirectUri - The callback URL to receive the authorization code
 * @param scopes      - Scopes to request (must be keys from `config.scopes`)
 * @returns Fully-formed authorization URL string
 *
 * @example
 * ```ts
 * const url = getAuthorizationUrl(
 *   config.auth.oauth2,
 *   'my-client-id',
 *   'https://myapp.com/callback',
 *   ['cart:read', 'cart:write'],
 * );
 * // Redirect the user to this URL
 * ```
 */
export function getAuthorizationUrl(
  config: OAuth2Auth,
  clientId: string,
  redirectUri: string,
  scopes: string[],
): string {
  const url = new URL(config.authorization_url);

  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopes.join(' '));

  return url.toString();
}

/**
 * Exchange an authorization code for an access token.
 *
 * @param config       - OAuth2 configuration from `auth.oauth2`
 * @param clientId     - The OAuth2 client ID
 * @param clientSecret - The OAuth2 client secret
 * @param code         - The authorization code received in the callback
 * @param redirectUri  - The same redirect URI used in the authorization request
 * @returns Token response containing the access token and optional refresh token
 * @throws {AuthenticationError} if the token exchange fails
 *
 * @example
 * ```ts
 * const tokens = await exchangeCode(
 *   config.auth.oauth2,
 *   'my-client-id',
 *   'my-client-secret',
 *   'auth-code-from-callback',
 *   'https://myapp.com/callback',
 * );
 * console.log(tokens.access_token);
 * ```
 */
export async function exchangeCode(
  config: OAuth2Auth,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  let response: Response;
  try {
    response = await fetch(config.token_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AuthenticationError(`Token exchange request failed: ${message}`);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const text = await response.text();
      if (text) {
        detail = `: ${text}`;
      }
    } catch {
      // ignore
    }
    throw new AuthenticationError(
      `Token exchange failed with HTTP ${response.status}${detail}`,
      response.status,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new AuthenticationError('Token response is not valid JSON');
  }

  const obj = data as Record<string, unknown>;
  if (typeof obj.access_token !== 'string') {
    throw new AuthenticationError(
      'Token response must contain an "access_token" string',
    );
  }

  return {
    access_token: obj.access_token,
    token_type: typeof obj.token_type === 'string' ? obj.token_type : 'Bearer',
    expires_in: typeof obj.expires_in === 'number' ? obj.expires_in : undefined,
    refresh_token: typeof obj.refresh_token === 'string' ? obj.refresh_token : undefined,
    scope: typeof obj.scope === 'string' ? obj.scope : undefined,
  };
}

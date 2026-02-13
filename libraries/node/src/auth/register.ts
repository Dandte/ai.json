// =============================================================================
// Agent registration with ia.json-compatible services
// =============================================================================

import type { AgentInfo, Credentials } from '../types.js';
import { AuthenticationError } from '../errors.js';

/**
 * Register an AI agent with a service that supports ia.json signed_key auth.
 *
 * Sends a POST request to the service's `register_url` with the agent's
 * information and returns the issued credentials (API key and signing secret).
 *
 * @param registerUrl - The registration URL from `auth.signed_key.register_url`
 * @param agentInfo   - Information about the agent being registered
 * @returns Credentials containing the API key and signing secret
 * @throws {AuthenticationError} if registration fails
 *
 * @example
 * ```ts
 * const creds = await register('https://example.com/ia/register', {
 *   name: 'MyAssistant',
 *   url: 'https://myassistant.ai',
 *   description: 'A helpful shopping assistant',
 *   contact: 'dev@myassistant.ai',
 * });
 * console.log(creds.api_key, creds.secret);
 * ```
 */
export async function register(
  registerUrl: string,
  agentInfo: AgentInfo,
): Promise<Credentials> {
  let response: Response;
  try {
    response = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentInfo),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AuthenticationError(`Registration request failed: ${message}`);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.text();
      if (body) {
        detail = `: ${body}`;
      }
    } catch {
      // ignore body read errors
    }
    throw new AuthenticationError(
      `Registration failed with HTTP ${response.status}${detail}`,
      response.status,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new AuthenticationError('Registration response is not valid JSON');
  }

  const obj = data as Record<string, unknown>;
  if (typeof obj.api_key !== 'string' || typeof obj.secret !== 'string') {
    throw new AuthenticationError(
      'Registration response must contain "api_key" and "secret" strings',
    );
  }

  return {
    api_key: obj.api_key,
    secret: obj.secret,
    expires_at: typeof obj.expires_at === 'string' ? obj.expires_at : undefined,
  };
}

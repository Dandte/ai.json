// =============================================================================
// ia.json discovery: fetch and parse ia.json from a domain
// =============================================================================

import type { IaJsonConfig } from './types.js';
import { DiscoveryError } from './errors.js';

/** Well-known paths where ia.json may be hosted, tried in order */
const DISCOVERY_PATHS = ['/ia.json', '/.well-known/ia.json'] as const;

/**
 * Validates that the parsed object looks like a valid ia.json configuration.
 * Performs structural checks on the required top-level fields.
 *
 * @throws {DiscoveryError} if the object fails validation
 */
function validate(data: unknown, domain: string): asserts data is IaJsonConfig {
  if (data === null || typeof data !== 'object') {
    throw new DiscoveryError('ia.json response is not a JSON object', domain);
  }

  const obj = data as Record<string, unknown>;

  // version
  if (typeof obj.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(obj.version)) {
    throw new DiscoveryError(
      'ia.json must contain a valid "version" field (semver string)',
      domain,
    );
  }

  // site
  if (obj.site === null || typeof obj.site !== 'object') {
    throw new DiscoveryError('ia.json must contain a "site" object', domain);
  }
  const site = obj.site as Record<string, unknown>;
  if (typeof site.name !== 'string' || site.name.length === 0) {
    throw new DiscoveryError('ia.json site.name must be a non-empty string', domain);
  }
  if (typeof site.type !== 'string') {
    throw new DiscoveryError('ia.json site.type must be a string', domain);
  }

  // api
  if (obj.api === null || typeof obj.api !== 'object') {
    throw new DiscoveryError('ia.json must contain an "api" object', domain);
  }
  const api = obj.api as Record<string, unknown>;
  if (typeof api.base_url !== 'string' || !api.base_url.startsWith('https://')) {
    throw new DiscoveryError('ia.json api.base_url must be an HTTPS URL', domain);
  }

  // At least one endpoint group must exist
  const hasEndpoints = ['public', 'protected', 'user_required'].some(
    (key) => api[key] !== undefined && api[key] !== null && typeof api[key] === 'object',
  );
  if (!hasEndpoints) {
    throw new DiscoveryError(
      'ia.json api must contain at least one endpoint group (public, protected, or user_required)',
      domain,
    );
  }
}

/**
 * Attempts to fetch and parse an ia.json file from a single URL.
 * Returns the parsed config on success, or null if the URL returns 404.
 *
 * @throws {DiscoveryError} on network errors or invalid responses (non-404)
 */
async function tryFetch(url: string, domain: string): Promise<IaJsonConfig | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new DiscoveryError(`Network error fetching ${url}: ${message}`, domain);
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new DiscoveryError(
      `HTTP ${response.status} fetching ${url}`,
      domain,
      response.status,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json') && !contentType.includes('text/plain')) {
    throw new DiscoveryError(
      `Unexpected content-type "${contentType}" from ${url}`,
      domain,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new DiscoveryError(`Invalid JSON in response from ${url}`, domain);
  }

  validate(data, domain);
  return data;
}

/**
 * Discover and parse an ia.json file from a domain.
 *
 * Tries the following locations in order:
 *   1. `https://{domain}/ia.json`
 *   2. `https://{domain}/.well-known/ia.json`
 *
 * @param domain - The domain to discover (e.g., "example.com")
 * @returns The parsed and validated ia.json configuration
 * @throws {DiscoveryError} if ia.json cannot be found or is invalid
 *
 * @example
 * ```ts
 * import { discover } from '@iajson/client';
 *
 * const config = await discover('techstore.example.com');
 * console.log(config.site.name); // "TechStore"
 * ```
 */
export async function discover(domain: string): Promise<IaJsonConfig> {
  if (!domain || typeof domain !== 'string') {
    throw new DiscoveryError('domain must be a non-empty string');
  }

  // Strip protocol if accidentally included
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  for (const path of DISCOVERY_PATHS) {
    const url = `https://${cleanDomain}${path}`;
    const config = await tryFetch(url, cleanDomain);
    if (config !== null) {
      return config;
    }
  }

  throw new DiscoveryError(
    `No ia.json found at ${cleanDomain} (tried /ia.json and /.well-known/ia.json)`,
    cleanDomain,
    404,
  );
}

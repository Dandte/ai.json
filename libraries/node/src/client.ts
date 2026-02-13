// =============================================================================
// IaJsonClient - main client class for interacting with ia.json services
// =============================================================================

import type {
  IaJsonConfig,
  Endpoint,
  AccessLevel,
  AgentInfo,
  Credentials,
} from './types.js';
import {
  IaJsonError,
  AuthenticationError,
  RateLimitError,
} from './errors.js';
import { discover } from './discovery.js';
import { sign as hmacSign, createSignedHeaders } from './auth/signer.js';
import { register as registerAgent } from './auth/register.js';

/** Internal endpoint entry with its name and access level attached */
interface ResolvedEndpoint {
  name: string;
  level: AccessLevel;
  endpoint: Endpoint;
}

/**
 * High-level client for consuming an ia.json-compatible service.
 *
 * Use the static `discover` factory to create an instance from a domain,
 * then optionally `register` the agent before making API calls.
 *
 * @example
 * ```ts
 * const client = await IaJsonClient.discover('techstore.example.com');
 * await client.register({ name: 'ShopBot', url: 'https://shopbot.ai' });
 * const response = await client.call('list_products', { page: 1 });
 * const products = await response.json();
 * ```
 */
export class IaJsonClient {
  /** The parsed ia.json configuration */
  public readonly config: IaJsonConfig;

  /** Credentials obtained from registration (undefined until `register` is called) */
  private credentials?: Credentials;

  /** OAuth2 access token for user_required endpoints */
  private accessToken?: string;

  /** Flat index of all endpoints keyed by name for O(1) lookup */
  private readonly endpointIndex: Map<string, ResolvedEndpoint>;

  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------

  constructor(config: IaJsonConfig) {
    this.config = config;
    this.endpointIndex = this.buildEndpointIndex();
  }

  /**
   * Discover an ia.json file from a domain and return a ready-to-use client.
   *
   * @param domain - The domain to discover (e.g., "example.com")
   * @returns A configured IaJsonClient instance
   */
  static async discover(domain: string): Promise<IaJsonClient> {
    const config = await discover(domain);
    return new IaJsonClient(config);
  }

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  /**
   * Register this agent with the service using signed_key authentication.
   *
   * The service must declare `auth.signed_key` in its ia.json.
   * After registration, subsequent calls to protected endpoints will
   * automatically include signed authentication headers.
   *
   * @param agentInfo - Information about the agent to register
   * @throws {AuthenticationError} if the service does not support signed_key auth
   * @throws {AuthenticationError} if registration fails
   */
  async register(agentInfo: AgentInfo): Promise<void> {
    const signedKey = this.config.auth?.signed_key;
    if (!signedKey) {
      throw new AuthenticationError(
        'This service does not support signed_key authentication',
      );
    }
    this.credentials = await registerAgent(signedKey.register_url, agentInfo);
  }

  /**
   * Set an OAuth2 access token for user_required endpoint calls.
   *
   * Obtain the token via the OAuth2 helpers (`getAuthorizationUrl` / `exchangeCode`)
   * and then set it here so that `call()` includes the Bearer token automatically.
   *
   * @param token - The OAuth2 access token
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Compute a signature for the given request body using the stored credentials.
   *
   * @param body - The request body string
   * @returns Object with the hex signature and the unix timestamp used
   * @throws {AuthenticationError} if the agent has not been registered yet
   */
  sign(body: string): { signature: string; timestamp: number } {
    if (!this.credentials) {
      throw new AuthenticationError(
        'Cannot sign requests before registration. Call register() first.',
      );
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = hmacSign(this.credentials.secret, timestamp, body);
    return { signature, timestamp };
  }

  // ---------------------------------------------------------------------------
  // Endpoint queries
  // ---------------------------------------------------------------------------

  /**
   * Get all endpoints, optionally filtered by access level.
   *
   * @param level - If provided, only return endpoints at this access level
   * @returns Array of endpoint definitions
   */
  getEndpoints(level?: AccessLevel): Endpoint[] {
    if (level) {
      return Array.from(this.endpointIndex.values())
        .filter((e) => e.level === level)
        .map((e) => e.endpoint);
    }
    return Array.from(this.endpointIndex.values()).map((e) => e.endpoint);
  }

  /**
   * Look up a single endpoint by its name.
   *
   * @param name - The endpoint name (e.g., "list_products")
   * @returns The resolved endpoint entry, or undefined if not found
   */
  getEndpoint(name: string): ResolvedEndpoint | undefined {
    return this.endpointIndex.get(name);
  }

  // ---------------------------------------------------------------------------
  // API calls
  // ---------------------------------------------------------------------------

  /**
   * Call a named API endpoint.
   *
   * - Path parameters (e.g., `{id}`) are interpolated from `params`.
   * - Query parameters are appended for GET/DELETE methods.
   * - Body parameters are sent as JSON for POST/PUT/PATCH methods.
   * - Authentication headers are attached automatically based on the
   *   endpoint's access level and available credentials.
   *
   * @param endpointName - The endpoint name as declared in the ia.json
   * @param params       - Key/value pairs for path, query, or body parameters
   * @returns The raw `Response` from the fetch call
   * @throws {IaJsonError} if the endpoint is not found
   * @throws {AuthenticationError} if credentials are missing for protected endpoints
   * @throws {RateLimitError} if the server responds with 429
   */
  async call(
    endpointName: string,
    params?: Record<string, unknown>,
  ): Promise<Response> {
    const resolved = this.endpointIndex.get(endpointName);
    if (!resolved) {
      throw new IaJsonError(
        `Unknown endpoint "${endpointName}". Available: ${Array.from(this.endpointIndex.keys()).join(', ')}`,
      );
    }

    const { level, endpoint } = resolved;
    const { method, path } = endpoint;

    // -- Build URL ----------------------------------------------------------

    let resolvedPath = path;
    const queryParams: Record<string, string> = {};
    const bodyParams: Record<string, unknown> = {};

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        const placeholder = `{${key}}`;
        if (resolvedPath.includes(placeholder)) {
          // Path parameter
          resolvedPath = resolvedPath.replace(placeholder, encodeURIComponent(String(value)));
        } else if (method === 'GET' || method === 'DELETE') {
          // Query parameter for GET/DELETE
          queryParams[key] = String(value);
        } else {
          // Body parameter for POST/PUT/PATCH
          bodyParams[key] = value;
        }
      }
    }

    const url = new URL(resolvedPath, this.config.api.base_url);
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }

    // -- Build headers ------------------------------------------------------

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const hasBody = method !== 'GET' && method !== 'DELETE' && Object.keys(bodyParams).length > 0;
    const bodyString = hasBody ? JSON.stringify(bodyParams) : '';

    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }

    // Attach signed_key auth for protected and user_required endpoints
    if (level !== 'public' && this.credentials) {
      const prefix = this.config.auth?.signed_key?.header_prefix ?? 'X-IA-';
      const signedHeaders = createSignedHeaders(
        this.credentials.api_key,
        this.credentials.secret,
        bodyString,
        prefix,
      );
      Object.assign(headers, signedHeaders);
    }

    // Attach OAuth2 bearer token for user_required endpoints
    if (level === 'user_required' && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Check that we have the right credentials
    if (level === 'protected' && !this.credentials) {
      throw new AuthenticationError(
        `Endpoint "${endpointName}" requires agent authentication. Call register() first.`,
      );
    }
    if (level === 'user_required' && !this.accessToken && !this.credentials) {
      throw new AuthenticationError(
        `Endpoint "${endpointName}" requires user authorization. Set an access token or register first.`,
      );
    }

    // -- Execute request ----------------------------------------------------

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: hasBody ? bodyString : undefined,
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      throw new RateLimitError(
        `Rate limited on endpoint "${endpointName}"`,
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );
    }

    return response;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Builds a flat map of endpoint name -> { name, level, endpoint } for fast lookup.
   */
  private buildEndpointIndex(): Map<string, ResolvedEndpoint> {
    const index = new Map<string, ResolvedEndpoint>();
    const levels: AccessLevel[] = ['public', 'protected', 'user_required'];

    for (const level of levels) {
      const group = this.config.api[level];
      if (!group) continue;
      for (const [name, endpoint] of Object.entries(group)) {
        index.set(name, { name, level, endpoint });
      }
    }

    return index;
  }
}

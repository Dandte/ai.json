// =============================================================================
// ia.json TypeScript Type Definitions
// Matches the ia.json schema specification v1.0.0
// =============================================================================

// -- Common types -------------------------------------------------------------

/** HTTP request method */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Data type for a parameter */
export type ParameterType = 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object';

/** Rate limit expression (e.g., "60/minute", "1000/hour") */
export type RateLimitString = `${number}/${'second' | 'minute' | 'hour' | 'day'}`;

// -- Parameter ----------------------------------------------------------------

/** API endpoint parameter definition */
export interface Parameter {
  /** Data type of the parameter */
  type: ParameterType;
  /** Whether this parameter is required */
  required: boolean;
  /** Human-readable description */
  description?: string;
  /** Default value */
  default?: unknown;
  /** Example value */
  example?: unknown;
  /** Allowed values */
  enum?: unknown[];
  /** Minimum value (for numbers) */
  min?: number;
  /** Maximum value (for numbers) */
  max?: number;
  /** Regex pattern (for strings) */
  pattern?: string;
}

// -- Site ---------------------------------------------------------------------

/** Site type classification */
export type SiteType =
  | 'ecommerce'
  | 'saas'
  | 'blog'
  | 'api'
  | 'marketplace'
  | 'social'
  | 'finance'
  | 'education'
  | 'healthcare'
  | 'government'
  | 'other';

/** Site metadata */
export interface Site {
  /** Human-readable site name */
  name: string;
  /** Type of site */
  type: SiteType;
  /** Short description of the site */
  description?: string;
  /** Site URL (HTTPS) */
  url?: string;
  /** URL or path to site logo */
  logo?: string;
  /** ISO 4217 currency code (e.g., USD, EUR) */
  currency?: string;
  /** BCP 47 language tag (e.g., en, es, pt-BR) */
  language?: string;
  /** IANA timezone identifier (e.g., America/New_York) */
  timezone?: string;
  /** Contact email address */
  contact?: string;
}

// -- API / Endpoints ----------------------------------------------------------

/** A single API endpoint definition */
export interface Endpoint {
  /** HTTP method */
  method: HttpMethod;
  /** URL path appended to base_url (starts with /) */
  path: string;
  /** Human-readable description of the endpoint */
  description: string;
  /** Query or path parameters */
  parameters?: Record<string, Parameter>;
  /** Request body fields (for POST/PUT/PATCH) */
  body?: Record<string, Parameter>;
  /** Response schema description */
  response?: Record<string, unknown>;
  /** Endpoint-specific rate limit */
  rate_limit?: RateLimitString;
  /** Required OAuth2 scopes */
  scopes?: string[];
  /** Whether this endpoint is deprecated */
  deprecated?: boolean;
}

/** A group of named endpoints at the same access level */
export type EndpointGroup = Record<string, Endpoint>;

/** Access level for endpoint groups */
export type AccessLevel = 'public' | 'protected' | 'user_required';

/** API section containing base URL and endpoint groups by access level */
export interface Api {
  /** Base URL for all API endpoints (HTTPS) */
  base_url: string;
  /** Endpoints requiring no authentication */
  public?: EndpointGroup;
  /** Endpoints requiring AI agent authentication */
  protected?: EndpointGroup;
  /** Endpoints requiring user authorization */
  user_required?: EndpointGroup;
}

// -- Auth ---------------------------------------------------------------------

/** Signed key authentication configuration */
export interface SignedKeyAuth {
  /** URL for AI agent registration */
  register_url: string;
  /** HMAC signing algorithm */
  algorithm: 'sha256' | 'sha512';
  /** Prefix for authentication headers (default: "X-IA-") */
  header_prefix?: string;
  /** Days before key rotation is required */
  key_rotation_days?: number;
}

/** OAuth2 authentication configuration */
export interface OAuth2Auth {
  /** OAuth2 authorization endpoint */
  authorization_url: string;
  /** OAuth2 token endpoint */
  token_url: string;
  /** Available scopes (key: scope name, value: description) */
  scopes: Record<string, string>;
  /** Supported OAuth2 grant types */
  grant_types?: Array<'authorization_code' | 'client_credentials'>;
  /** Whether PKCE is required */
  pkce_required?: boolean;
}

/** Simple API key authentication configuration */
export interface ApiKeyAuth {
  /** Header name for the API key */
  header: string;
  /** URL to request an API key */
  request_url?: string;
}

/** Bearer token authentication configuration */
export interface BearerAuth {
  /** URL to obtain a bearer token */
  token_url: string;
  /** Token lifetime in seconds */
  expires_in?: number;
}

/** Authentication methods configuration */
export interface Auth {
  /** AI agent key-based authentication with request signing */
  signed_key?: SignedKeyAuth;
  /** OAuth2 for user authorization */
  oauth2?: OAuth2Auth;
  /** Simple API key authentication */
  api_key?: ApiKeyAuth;
  /** Bearer token authentication */
  bearer?: BearerAuth;
}

// -- Security -----------------------------------------------------------------

/** Auto-block configuration for failed authentication attempts */
export interface AutoBlock {
  /** Number of failed attempts before blocking */
  failed_attempts: number;
  /** Time window for counting failures (minutes) */
  window_minutes: number;
  /** How long to block the agent (minutes) */
  block_duration_minutes: number;
}

/** Security policies for AI agent interactions */
export interface Security {
  /** Whether HTTPS is required for all requests (default: true) */
  https_required?: boolean;
  /** Global rate limit for all endpoints */
  rate_limit?: RateLimitString;
  /** Whether request signatures are verified (default: false) */
  verify_signature?: boolean;
  /** Maximum request body size (e.g., "1mb", "512kb") */
  max_request_size?: string;
  /** Allowed origins for CORS */
  allowed_origins?: string[];
  /** Allowed IP addresses or CIDR ranges */
  ip_whitelist?: string[];
  /** Auto-block configuration */
  auto_block?: AutoBlock;
}

// -- Capabilities -------------------------------------------------------------

/** Feature flags indicating what the site supports */
export interface Capabilities {
  /** Read/query data */
  read?: boolean;
  /** Create or modify data */
  write?: boolean;
  /** Delete data */
  delete?: boolean;
  /** Full-text search */
  search?: boolean;
  /** E-commerce checkout */
  checkout?: boolean;
  /** User account operations */
  user_management?: boolean;
  /** Real-time event notifications */
  webhooks?: boolean;
  /** Batch/bulk API calls */
  bulk_operations?: boolean;
  /** WebSocket or SSE support */
  real_time?: boolean;
  /** Custom capabilities (keys starting with x_) */
  [key: `x_${string}`]: boolean | undefined;
}

// -- Webhooks -----------------------------------------------------------------

/** A single webhook event definition */
export interface WebhookEvent {
  /** Human-readable description of the event */
  description: string;
  /** Description of the webhook payload fields */
  payload?: Record<string, Parameter>;
}

/** Webhook event declarations (keyed by event name) */
export type Webhooks = Record<string, WebhookEvent>;

// -- Metadata -----------------------------------------------------------------

/** File metadata */
export interface Metadata {
  /** Creation date (ISO 8601) */
  created?: string;
  /** Last update date (ISO 8601) */
  updated?: string;
  /** Version of the ia.json spec used */
  spec_version?: string;
  /** Tool or method used to generate the file */
  generator?: string;
  /** URL to the site's API documentation */
  docs_url?: string;
  /** URL for developer support */
  support_url?: string;
}

// -- Root config --------------------------------------------------------------

/** Root ia.json configuration object */
export interface IaJsonConfig {
  /** ia.json specification version (semver) */
  version: string;
  /** Site metadata */
  site: Site;
  /** API endpoint declarations */
  api: Api;
  /** Authentication methods */
  auth?: Auth;
  /** Security policies */
  security?: Security;
  /** Feature flags */
  capabilities?: Capabilities;
  /** Webhook event declarations */
  webhooks?: Webhooks;
  /** File metadata */
  metadata?: Metadata;
}

// -- Agent / Registration -----------------------------------------------------

/** Information about an AI agent for registration */
export interface AgentInfo {
  /** Name of the AI agent */
  name: string;
  /** URL identifying the agent */
  url: string;
  /** Description of the agent's purpose */
  description?: string;
  /** Contact email for the agent operator */
  contact?: string;
  /** Requested capabilities or scopes */
  capabilities?: string[];
}

/** Credentials returned from agent registration */
export interface Credentials {
  /** API key for the agent */
  api_key: string;
  /** Signing secret for request authentication */
  secret: string;
  /** Expiration date (ISO 8601), if applicable */
  expires_at?: string;
}

/** Token response from OAuth2 token exchange */
export interface TokenResponse {
  /** Access token */
  access_token: string;
  /** Token type (typically "Bearer") */
  token_type: string;
  /** Token lifetime in seconds */
  expires_in?: number;
  /** Refresh token, if provided */
  refresh_token?: string;
  /** Granted scopes (space-separated) */
  scope?: string;
}

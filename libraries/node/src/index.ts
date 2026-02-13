// =============================================================================
// @iajson/client - Node.js/TypeScript client library for ia.json
// =============================================================================

// -- Types --------------------------------------------------------------------
export type {
  IaJsonConfig,
  Site,
  SiteType,
  Api,
  Endpoint,
  EndpointGroup,
  AccessLevel,
  Parameter,
  ParameterType,
  HttpMethod,
  RateLimitString,
  Auth,
  SignedKeyAuth,
  OAuth2Auth,
  ApiKeyAuth,
  BearerAuth,
  Security,
  AutoBlock,
  Capabilities,
  Webhooks,
  WebhookEvent,
  Metadata,
  AgentInfo,
  Credentials,
  TokenResponse,
} from './types.js';

// -- Errors -------------------------------------------------------------------
export {
  IaJsonError,
  AuthenticationError,
  RateLimitError,
  DiscoveryError,
} from './errors.js';

// -- Discovery ----------------------------------------------------------------
export { discover } from './discovery.js';

// -- Auth ---------------------------------------------------------------------
export { sign, createSignedHeaders } from './auth/signer.js';
export { register } from './auth/register.js';
export { getAuthorizationUrl, exchangeCode } from './auth/oauth.js';

// -- Client -------------------------------------------------------------------
export { IaJsonClient } from './client.js';

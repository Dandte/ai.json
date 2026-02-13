# @iajson/client

Node.js/TypeScript client library for discovering and consuming [ia.json](https://iajson.org) files -- the universal standard for AI interaction with websites.

Requires **Node.js 18+** (uses native `fetch` and `node:crypto`). Zero production dependencies.

## Installation

```bash
npm install iajson-client
```

## Quick Start

```ts
import { IaJsonClient } from '@iajson/client';

// 1. Discover the ia.json from a domain
const client = await IaJsonClient.discover('techstore.example.com');

// 2. Register your agent (for protected endpoints)
await client.register({
  name: 'ShopBot',
  url: 'https://shopbot.ai',
  description: 'An AI shopping assistant',
  contact: 'dev@shopbot.ai',
});

// 3. Call API endpoints by name
const response = await client.call('list_products', { page: 1, per_page: 10 });
const products = await response.json();
```

## API Reference

### Discovery

```ts
import { discover } from '@iajson/client';

// Tries /ia.json then /.well-known/ia.json
const config = await discover('example.com');
console.log(config.site.name);
console.log(config.api.base_url);
```

### IaJsonClient

The main class for interacting with ia.json-compatible services.

```ts
import { IaJsonClient } from '@iajson/client';

// Create via discovery
const client = await IaJsonClient.discover('example.com');

// Or from an existing config object
const client2 = new IaJsonClient(existingConfig);
```

#### `client.register(agentInfo)`

Register the agent with the service's signed_key authentication.

```ts
await client.register({
  name: 'MyAgent',
  url: 'https://myagent.ai',
  description: 'Helpful assistant',
  contact: 'hello@myagent.ai',
});
```

#### `client.call(endpointName, params?)`

Call a named endpoint. Path parameters, query parameters, and body parameters are all passed in the same `params` object -- the client routes them correctly based on the endpoint definition and HTTP method.

```ts
// GET with path parameter
const product = await client.call('get_product', { id: 'prod_abc123' });

// POST with body parameters
const order = await client.call('add_to_cart', {
  product_id: 'prod_abc123',
  quantity: 2,
});
```

#### `client.getEndpoints(level?)`

Retrieve endpoint definitions, optionally filtered by access level.

```ts
const allEndpoints = client.getEndpoints();
const publicOnly = client.getEndpoints('public');
const protectedOnly = client.getEndpoints('protected');
const userRequired = client.getEndpoints('user_required');
```

#### `client.sign(body)`

Manually sign a request body using the registered credentials.

```ts
const { signature, timestamp } = client.sign('{"key":"value"}');
```

#### `client.setAccessToken(token)`

Set an OAuth2 access token for `user_required` endpoints.

```ts
client.setAccessToken('eyJhbGciOiJSUzI1NiIs...');
```

### Request Signing

Low-level signing utilities for building custom request flows.

```ts
import { sign, createSignedHeaders } from '@iajson/client';

// Compute a raw HMAC-SHA256 signature
const signature = sign('my-secret', Math.floor(Date.now() / 1000), '{"data":1}');

// Generate the full set of ia.json auth headers
const headers = createSignedHeaders('api-key', 'secret', '{"data":1}', 'X-IA-');
// => { "X-IA-Key": "api-key", "X-IA-Timestamp": "17...", "X-IA-Signature": "a1b2..." }
```

### Agent Registration

Register directly without the client class.

```ts
import { register } from '@iajson/client';

const credentials = await register('https://example.com/ia/register', {
  name: 'MyAgent',
  url: 'https://myagent.ai',
});
console.log(credentials.api_key, credentials.secret);
```

### OAuth2

Helpers for the OAuth2 authorization code flow.

```ts
import { getAuthorizationUrl, exchangeCode } from '@iajson/client';

// Step 1: Build the authorization URL
const authUrl = getAuthorizationUrl(
  config.auth.oauth2,
  'client-id',
  'https://myapp.com/callback',
  ['cart:read', 'orders:read'],
);
// Redirect the user to authUrl...

// Step 2: Exchange the code for tokens
const tokens = await exchangeCode(
  config.auth.oauth2,
  'client-id',
  'client-secret',
  codeFromCallback,
  'https://myapp.com/callback',
);
console.log(tokens.access_token);
```

## Error Handling

All errors extend from `IaJsonError` for easy catching.

```ts
import {
  IaJsonError,
  AuthenticationError,
  RateLimitError,
  DiscoveryError,
} from '@iajson/client';

try {
  const client = await IaJsonClient.discover('unknown.example.com');
} catch (err) {
  if (err instanceof DiscoveryError) {
    console.error('Discovery failed:', err.message, err.domain);
  } else if (err instanceof RateLimitError) {
    console.error('Rate limited. Retry after:', err.retryAfter, 'seconds');
  } else if (err instanceof AuthenticationError) {
    console.error('Auth failed:', err.message);
  } else if (err instanceof IaJsonError) {
    console.error('ia.json error:', err.message, err.statusCode);
  }
}
```

## Types

All TypeScript types are exported for use in your own code.

```ts
import type {
  IaJsonConfig,
  Site,
  Api,
  Endpoint,
  Parameter,
  Auth,
  SignedKeyAuth,
  OAuth2Auth,
  ApiKeyAuth,
  BearerAuth,
  Security,
  Capabilities,
  Webhooks,
  Metadata,
  AgentInfo,
  Credentials,
  TokenResponse,
} from '@iajson/client';
```

## License

MIT

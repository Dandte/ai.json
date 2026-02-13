# How AIs Consume ia.json

This guide explains how AI agents discover and use ia.json files to interact with websites.

## Discovery Flow

```
1. User asks AI to interact with example.com
2. AI fetches https://example.com/ia.json
3. If 404, AI tries https://example.com/.well-known/ia.json
4. AI parses the JSON and understands the site's capabilities
5. AI can now make API calls as declared in the file
```

## Step-by-Step Integration

### 1. Fetch the ia.json File

```typescript
// Node.js
import { IaJsonClient } from '@iajson/client';

const client = await IaJsonClient.discover('example.com');
```

```python
# Python
from iajson import IaJsonClient

client = IaJsonClient.discover('example.com')
```

```php
// PHP
use IaJson\Client\IaJsonClient;

$client = IaJsonClient::discover('example.com');
```

### 2. Read Site Information

```typescript
const config = client.config;
console.log(config.site.name);     // "My Store"
console.log(config.site.type);     // "ecommerce"
console.log(config.site.currency); // "USD"
```

### 3. List Available Endpoints

```typescript
// All endpoints
const all = client.getEndpoints();

// Only public endpoints
const public = client.getEndpoints('public');

// Only endpoints requiring authentication
const protected = client.getEndpoints('protected');
```

### 4. Call Public Endpoints

Public endpoints require no authentication:

```typescript
const results = await client.call('search_products', { q: 'laptop' });
```

The client automatically:
- Resolves the full URL from `base_url` + endpoint `path`
- Uses the correct HTTP method
- Passes parameters appropriately (query params for GET, body for POST)

### 5. Register for Protected Endpoints

If the site has protected endpoints, register your AI agent:

```typescript
await client.register({
  name: 'My AI Assistant',
  domain: 'myai.example.com',
  webhook_url: 'https://myai.example.com/verify',
  contact: 'admin@myai.example.com'
});
```

After registration, the client automatically signs all requests to protected endpoints.

### 6. Handle User Authorization

For `user_required` endpoints, you need an OAuth2 token from the user:

```typescript
// Get the authorization URL to redirect the user
const authUrl = client.getAuthorizationUrl({
  clientId: 'your-client-id',
  redirectUri: 'https://myai.example.com/callback',
  scopes: ['orders:read', 'cart:write']
});

// After user authorizes, exchange the code for a token
const token = await client.exchangeCode(code, redirectUri);

// Now you can call user_required endpoints
const orders = await client.call('list_orders', {}, { userToken: token });
```

## Respecting Security Policies

### Rate Limits

Always check and respect rate limits:

```typescript
const security = client.config.security;
console.log(security.rate_limit); // "1000/hour"
```

If you receive a `429` response, implement exponential backoff:

```typescript
async function callWithRetry(client, endpoint, params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.call(endpoint, params);
    } catch (err) {
      if (err.status === 429) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}
```

### HTTPS

Always use HTTPS. The client libraries enforce this by default.

### Caching

Cache the ia.json file according to the HTTP cache headers. Don't fetch it on every request.

## Error Handling

ia.json-compliant sites return errors in this format:

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "You have exceeded the rate limit of 1000 requests per hour"
  }
}
```

Common error codes:

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `invalid_key` | 401 | API key is invalid or revoked |
| `expired_timestamp` | 401 | Request timestamp is too old |
| `invalid_signature` | 401 | HMAC signature doesn't match |
| `rate_limit_exceeded` | 429 | Too many requests |
| `agent_blocked` | 403 | Agent has been blocked |
| `scope_required` | 403 | Missing required OAuth2 scope |
| `not_found` | 404 | Resource not found |

## Best Practices

1. **Cache ia.json** - Don't fetch it on every request
2. **Respect rate limits** - Implement backoff on 429 responses
3. **Handle errors gracefully** - Don't crash on unexpected responses
4. **Use the right access level** - Don't try to access protected endpoints without auth
5. **Keep credentials secure** - Store API keys and secrets safely
6. **Rotate keys** - Follow the site's `key_rotation_days` policy
7. **Log sparingly** - Don't log secrets or user tokens

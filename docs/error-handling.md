# Error Handling

How to handle errors when interacting with ia.json-compliant APIs.

## Error Response Format

All ia.json-compliant APIs should return errors in this format:

```json
{
  "error": {
    "code": "error_code",
    "message": "Human-readable error description",
    "details": {}
  }
}
```

## Error Codes Reference

### Authentication Errors (4xx)

| HTTP Status | Code | Description | Action |
|-------------|------|-------------|--------|
| 401 | `invalid_key` | API key is invalid or has been revoked | Re-register your agent |
| 401 | `expired_timestamp` | Request timestamp is too old (>60s) | Sync your clock, retry |
| 401 | `invalid_signature` | HMAC signature doesn't match | Check signing implementation |
| 401 | `expired_token` | OAuth2 token has expired | Refresh the token |
| 403 | `agent_blocked` | Your agent has been blocked | Contact site admin |
| 403 | `scope_required` | Missing required OAuth2 scope | Request additional scopes |
| 403 | `insufficient_permissions` | Key doesn't have access to this endpoint | Check key permissions |

### Rate Limiting Errors

| HTTP Status | Code | Description | Action |
|-------------|------|-------------|--------|
| 429 | `rate_limit_exceeded` | Too many requests | Wait and retry with backoff |

When you receive a 429 response, check the `Retry-After` header:

```typescript
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
  await sleep(retryAfter * 1000);
  // Retry the request
}
```

### Client Errors

| HTTP Status | Code | Description | Action |
|-------------|------|-------------|--------|
| 400 | `invalid_request` | Malformed request | Check parameters |
| 400 | `invalid_parameter` | Invalid parameter value | Check parameter constraints |
| 404 | `not_found` | Resource not found | Verify the resource exists |
| 405 | `method_not_allowed` | Wrong HTTP method | Check ia.json for correct method |
| 413 | `request_too_large` | Body exceeds max_request_size | Reduce payload size |
| 422 | `validation_error` | Request validation failed | Check the `details` field |

### Server Errors

| HTTP Status | Code | Description | Action |
|-------------|------|-------------|--------|
| 500 | `internal_error` | Server error | Retry after a delay |
| 502 | `bad_gateway` | Upstream error | Retry after a delay |
| 503 | `service_unavailable` | Temporarily unavailable | Check `Retry-After` header |

## Retry Strategy

Implement exponential backoff with jitter:

```typescript
async function callWithRetry(
  fn: () => Promise<Response>,
  maxRetries: number = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fn();

      if (response.status === 429 || response.status >= 500) {
        if (attempt === maxRetries) return response;

        const retryAfter = response.headers.get('Retry-After');
        const baseDelay = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, attempt) * 1000;

        // Add jitter (0-25% of delay)
        const jitter = baseDelay * Math.random() * 0.25;
        await new Promise(r => setTimeout(r, baseDelay + jitter));
        continue;
      }

      return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }

  throw new Error('Max retries exceeded');
}
```

## Best Practices

1. **Always check the HTTP status code first** before parsing the body
2. **Log error codes** for debugging, but don't expose them to end users
3. **Don't retry on 4xx errors** (except 429) - these indicate client bugs
4. **Do retry on 5xx errors** with exponential backoff
5. **Set reasonable timeouts** (10-30 seconds) for API calls
6. **Handle network errors** separately from API errors

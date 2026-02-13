# Security Best Practices

Recommendations for securing your ia.json implementation.

## For Website Owners

### 1. Always Require HTTPS

```json
{
  "security": {
    "https_required": true
  }
}
```

Never serve your API over plain HTTP. This protects API keys, signatures, and user data in transit.

### 2. Enable Request Signing

```json
{
  "auth": {
    "signed_key": {
      "register_url": "https://yoursite.com/ia/register",
      "algorithm": "sha256"
    }
  },
  "security": {
    "verify_signature": true
  }
}
```

Request signing prevents:
- Unauthorized access
- Request tampering
- Replay attacks (when combined with timestamp validation)

### 3. Set Rate Limits

```json
{
  "security": {
    "rate_limit": "1000/hour",
    "auto_block": {
      "failed_attempts": 10,
      "window_minutes": 5,
      "block_duration_minutes": 60
    }
  }
}
```

- Set both global and per-endpoint rate limits
- Use auto_block to automatically block misbehaving agents
- Start conservative and increase limits as needed

### 4. Limit Request Size

```json
{
  "security": {
    "max_request_size": "1mb"
  }
}
```

Prevents large payload attacks.

### 5. Require PKCE for OAuth2

```json
{
  "auth": {
    "oauth2": {
      "pkce_required": true
    }
  }
}
```

PKCE (Proof Key for Code Exchange) prevents authorization code interception attacks.

### 6. Use Key Rotation

```json
{
  "auth": {
    "signed_key": {
      "key_rotation_days": 90
    }
  }
}
```

Regularly rotating keys limits the damage if a key is compromised.

### 7. Validate All Input

On your API endpoints:
- Sanitize all input from AI agents
- Enforce maximum query string lengths
- Validate parameter types and ranges
- Never trust client-side data

### 8. Don't Expose Internal Endpoints

Only list endpoints in ia.json that are intended for AI interaction. Never expose:
- Admin endpoints
- Internal microservice endpoints
- Debug/diagnostic endpoints
- Database management endpoints

### 9. Monitor Agent Activity

- Log all API key usage
- Set up alerts for unusual patterns
- Track failed authentication attempts
- Review blocked agents regularly

### 10. Keep Your ia.json Updated

- Remove deprecated endpoints promptly
- Update rate limits based on actual usage
- Rotate the registered AI agent keys regularly

## For AI Developers

### 1. Store Secrets Securely

- Never hardcode API keys or secrets in source code
- Use environment variables or secret management services
- Never log secrets

### 2. Handle Errors Gracefully

- Don't retry indefinitely on auth failures
- Implement exponential backoff on rate limit errors
- Don't expose error details to end users

### 3. Respect Rate Limits

- Track your request rate
- Implement request queuing
- Honor `Retry-After` headers

### 4. Validate ia.json Before Processing

Always validate the ia.json file before using it:

```typescript
import { validate } from 'ia-json-validator';

const result = validate(iaJsonContent);
if (!result.valid) {
  // Don't process invalid files
  console.error('Invalid ia.json:', result.errors);
}
```

### 5. Use HTTPS Exclusively

Never downgrade to HTTP, even if the site responds on HTTP.

### 6. Implement Key Rotation

- Track key expiration dates
- Re-register before keys expire
- Handle key rejection gracefully (re-register)

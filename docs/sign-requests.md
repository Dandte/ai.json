# Sign Requests

This guide explains how to sign API requests when using ia.json's `signed_key` authentication.

## Why Sign Requests?

Request signing proves that:
- The request comes from a registered AI agent
- The request hasn't been tampered with
- The request is recent (prevents replay attacks)

## Signing Algorithm

### Step 1: Get the Current Timestamp

Use the current Unix timestamp in seconds:

```
timestamp = 1707753600
```

### Step 2: Create the Signing String

Concatenate the timestamp and request body with a dot separator:

```
signing_string = "{timestamp}.{body}"
```

For GET requests with no body:
```
signing_string = "{timestamp}."
```

For POST/PUT/PATCH requests:
```
signing_string = "1707753600.{\"product_id\":\"prod_123\",\"quantity\":2}"
```

### Step 3: Compute the HMAC Signature

Use HMAC with the algorithm specified in the ia.json `auth.signed_key.algorithm` field (usually `sha256`):

```
signature = HMAC-SHA256(secret, signing_string)
```

Output the signature as a hexadecimal string.

### Step 4: Set the Headers

Add three headers using the configured prefix (default: `X-IA-`):

```http
X-IA-Key: ia_live_abc123def456
X-IA-Signature: a1b2c3d4e5f6...
X-IA-Timestamp: 1707753600
```

## Implementation Examples

### Node.js

```typescript
import { createHmac } from 'node:crypto';

function signRequest(
  secret: string,
  timestamp: number,
  body: string
): string {
  const signingString = `${timestamp}.${body}`;
  return createHmac('sha256', secret)
    .update(signingString)
    .digest('hex');
}

// Usage
const timestamp = Math.floor(Date.now() / 1000);
const body = JSON.stringify({ product_id: 'prod_123', quantity: 2 });
const signature = signRequest('sec_xyz789uvw012', timestamp, body);

// Set headers
const headers = {
  'X-IA-Key': 'ia_live_abc123def456',
  'X-IA-Signature': signature,
  'X-IA-Timestamp': String(timestamp),
  'Content-Type': 'application/json'
};
```

### Python

```python
import hmac
import hashlib
import time
import json

def sign_request(secret: str, timestamp: int, body: str) -> str:
    signing_string = f"{timestamp}.{body}"
    return hmac.new(
        secret.encode(),
        signing_string.encode(),
        hashlib.sha256
    ).hexdigest()

# Usage
timestamp = int(time.time())
body = json.dumps({"product_id": "prod_123", "quantity": 2})
signature = sign_request("sec_xyz789uvw012", timestamp, body)

headers = {
    "X-IA-Key": "ia_live_abc123def456",
    "X-IA-Signature": signature,
    "X-IA-Timestamp": str(timestamp),
    "Content-Type": "application/json"
}
```

### PHP

```php
function signRequest(string $secret, int $timestamp, string $body): string {
    $signingString = "{$timestamp}.{$body}";
    return hash_hmac('sha256', $signingString, $secret);
}

// Usage
$timestamp = time();
$body = json_encode(['product_id' => 'prod_123', 'quantity' => 2]);
$signature = signRequest('sec_xyz789uvw012', $timestamp, $body);

$headers = [
    'X-IA-Key' => 'ia_live_abc123def456',
    'X-IA-Signature' => $signature,
    'X-IA-Timestamp' => (string) $timestamp,
    'Content-Type' => 'application/json'
];
```

## Verification (Server Side)

When receiving a signed request, the server should:

1. **Extract headers**: Get the key, signature, and timestamp
2. **Check timestamp**: Reject if older than 60 seconds
3. **Look up the secret**: Find the secret associated with the API key
4. **Recompute signature**: Use the same algorithm
5. **Compare**: Use constant-time comparison to prevent timing attacks

```typescript
function verifySignature(
  apiKey: string,
  signature: string,
  timestamp: string,
  body: string,
  secrets: Map<string, string>
): boolean {
  // Check timestamp freshness (60 seconds max)
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (Math.abs(now - ts) > 60) {
    return false; // expired_timestamp
  }

  // Look up secret
  const secret = secrets.get(apiKey);
  if (!secret) {
    return false; // invalid_key
  }

  // Recompute signature
  const signingString = `${timestamp}.${body}`;
  const expected = createHmac('sha256', secret)
    .update(signingString)
    .digest('hex');

  // Constant-time comparison
  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

## Test Vector

Use this test vector to verify your signing implementation:

```
Algorithm: sha256
Secret: "test_secret_key_123"
Timestamp: 1707753600
Body: '{"product_id":"prod_001","quantity":1}'
Signing string: '1707753600.{"product_id":"prod_001","quantity":1}'
```

Compute `HMAC-SHA256("test_secret_key_123", signing_string)` and compare with your implementation.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using milliseconds instead of seconds | Divide `Date.now()` by 1000 |
| Encoding body differently than what's sent | Sign the exact body string that's sent |
| Using the wrong algorithm | Check `auth.signed_key.algorithm` in ia.json |
| Not URL-encoding the body for GET requests | For GET, sign an empty body (just timestamp + dot) |

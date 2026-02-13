# Register Your AI Agent

This guide explains how to register an AI agent with a site that uses ia.json's `signed_key` authentication.

## When Registration is Required

Registration is required when the site has:
- `protected` endpoints in its ia.json
- An `auth.signed_key` configuration

## Registration Flow

### Step 1: Check if Registration is Needed

```typescript
const client = await IaJsonClient.discover('example.com');
const auth = client.config.auth;

if (auth?.signed_key) {
  console.log('Registration required');
  console.log('Register at:', auth.signed_key.register_url);
}
```

### Step 2: Send Registration Request

Send a POST request to the `register_url`:

```http
POST https://example.com/ia/register
Content-Type: application/json

{
  "name": "My AI Assistant",
  "domain": "myai.example.com",
  "webhook_url": "https://myai.example.com/verify",
  "contact": "admin@myai.example.com",
  "description": "AI assistant for shopping"
}
```

**Required fields:**

| Field | Description |
|-------|-------------|
| `name` | Display name of your AI agent |
| `domain` | Your AI agent's domain |
| `webhook_url` | URL where the site will send a verification code |
| `contact` | Contact email for your organization |

**Optional fields:**

| Field | Description |
|-------|-------------|
| `description` | Short description of what your AI does |

### Step 3: Handle Domain Verification

The site will send a POST request to your `webhook_url`:

```json
POST https://myai.example.com/verify
Content-Type: application/json

{
  "verification_code": "vc_abc123def456",
  "site": "example.com",
  "expires_at": "2026-02-12T12:00:00Z"
}
```

Your webhook endpoint should:
1. Receive the verification code
2. Store it temporarily
3. Return HTTP 200

### Step 4: Confirm Verification

Send the verification code back to the site:

```http
POST https://example.com/ia/verify
Content-Type: application/json

{
  "verification_code": "vc_abc123def456"
}
```

### Step 5: Receive Credentials

On successful verification, the site responds with your credentials:

```json
{
  "api_key": "ia_live_abc123def456",
  "secret": "sec_xyz789uvw012",
  "expires_at": "2026-05-12T00:00:00Z",
  "permissions": ["public", "protected"]
}
```

**Store these securely.** The `secret` is only sent once and cannot be recovered.

### Step 6: Use Credentials

Now you can access protected endpoints. See [Sign Requests](sign-requests.md) for how to sign each request.

## Using the Client Libraries

The reference libraries handle the entire registration flow:

### Node.js
```typescript
const client = await IaJsonClient.discover('example.com');

await client.register({
  name: 'My AI Assistant',
  domain: 'myai.example.com',
  webhookUrl: 'https://myai.example.com/verify',
  contact: 'admin@myai.example.com'
});

// Client is now authenticated and can call protected endpoints
const data = await client.call('get_inventory');
```

### Python
```python
client = IaJsonClient.discover('example.com')

client.register({
    'name': 'My AI Assistant',
    'domain': 'myai.example.com',
    'webhook_url': 'https://myai.example.com/verify',
    'contact': 'admin@myai.example.com'
})

data = client.call('get_inventory')
```

### PHP
```php
$client = IaJsonClient::discover('example.com');

$client->register([
    'name' => 'My AI Assistant',
    'domain' => 'myai.example.com',
    'webhook_url' => 'https://myai.example.com/verify',
    'contact' => 'admin@myai.example.com'
]);

$data = $client->call('get_inventory');
```

## Key Rotation

Sites may require key rotation (see `auth.signed_key.key_rotation_days`). When your key is about to expire:

1. Re-register with the same credentials
2. The site will issue new credentials
3. Update your stored credentials
4. Continue using the new key

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Registration fails with 400 | Check that all required fields are present |
| Verification code not received | Ensure your webhook URL is publicly accessible |
| Verification code expired | Request a new registration |
| Credentials rejected | Check key expiration, consider re-registering |

# iajson/client

PHP reference library for consuming [ia.json](https://iajson.org) files -- the universal standard for AI interaction with websites.

## Requirements

- PHP 8.1 or higher
- ext-json
- ext-hash

## Installation

Add the repository to your `composer.json` and require the package:

```json
{
  "repositories": [
    {
      "type": "vcs",
      "url": "https://github.com/Dandte/ai.json"
    }
  ],
  "require": {
    "iajson/client": "dev-main"
  }
}
```

Then run:

```bash
composer update iajson/client
```

## Quick Start

```php
use IaJson\Client\IaJsonClient;

// Discover a site's ia.json and create a client
$client = IaJsonClient::discover('techstore.example.com');

// Call a public endpoint (no authentication needed)
$results = $client->call('search_products', ['q' => 'wireless headphones']);

// Inspect the site
$site = $client->getSite();
echo $site['name']; // "TechStore"
echo $site['type']; // "ecommerce"
```

## Discovery

The library follows the ia.json discovery algorithm:

1. Tries `https://{domain}/ia.json`
2. Falls back to `https://{domain}/.well-known/ia.json`
3. Validates the spec structure and version compatibility

```php
use IaJson\Client\Discovery;

$discovery = new Discovery();
$spec = $discovery->fetch('example.com');

// $spec is the full parsed ia.json array
echo $spec['version'];        // "1.0.0"
echo $spec['api']['base_url']; // "https://example.com/api/v1"
```

## Browsing Endpoints

```php
$client = IaJsonClient::discover('techstore.example.com');

// Get all endpoints
$all = $client->getEndpoints();

// Get only public endpoints
$public = $client->getEndpoints('public');

// Get protected endpoints (require agent auth)
$protected = $client->getEndpoints('protected');

// Get user_required endpoints (require OAuth)
$userRequired = $client->getEndpoints('user_required');

// Check capabilities
if ($client->hasCapability('search')) {
    $results = $client->call('search_products', ['q' => 'laptop']);
}

// Get rate limit info
$rateLimit = $client->getRateLimit(); // e.g., "1000/hour"
```

## Authentication

### Signed Key Registration

For `protected` endpoints, you must register your AI agent and receive credentials:

```php
$client = IaJsonClient::discover('techstore.example.com');

// Step 1: Register your agent
$response = $client->register([
    'name' => 'My AI Assistant',
    'domain' => 'myai.example.com',
    'webhook_url' => 'https://myai.example.com/ia/verify',
    'contact' => 'admin@myai.example.com',
    'description' => 'AI shopping assistant',
]);

// Step 2: Your webhook receives a verification_code from the site.
// Step 3: Submit the verification code:
$credentials = $client->verify('vc_abc123def456');

// The client now has credentials set automatically.
// You can also store and re-use them:
echo $credentials['api_key']; // "ia_live_..."
echo $credentials['secret'];  // "sec_..."
```

### Using Existing Credentials

If you already have credentials from a previous registration:

```php
$client = IaJsonClient::discover('techstore.example.com');
$client->setCredentials('ia_live_abc123', 'sec_xyz789');

// Now you can call protected endpoints
$inventory = $client->call('get_inventory');
```

### OAuth2 (User Authorization)

For `user_required` endpoints, you need the user's OAuth2 token:

```php
$client = IaJsonClient::discover('techstore.example.com');
$client->setCredentials('ia_live_abc123', 'sec_xyz789');

// Get the OAuth helper
$oauth = $client->getOAuth(
    clientId: 'your_client_id',
    clientSecret: 'your_client_secret',
);

// Step 1: Get the authorization URL for the user to visit
$result = $oauth->getAuthorizationUrl(
    redirectUri: 'https://myai.example.com/callback',
    scopes: ['cart:read', 'cart:write', 'orders:write'],
    state: 'random_csrf_token',
);

echo $result['url']; // Redirect user here
// If PKCE is required, store $result['code_verifier'] in the session

// Step 2: After the user authorizes, exchange the code
$tokens = $oauth->exchangeCode(
    code: $_GET['code'],
    redirectUri: 'https://myai.example.com/callback',
    codeVerifier: $result['code_verifier'] ?? null, // If PKCE
);

// The OAuth helper stores tokens internally.
// Or set a token directly:
$client->setOAuthToken($tokens['access_token']);

// Now call user_required endpoints
$cart = $client->call('get_cart');
$client->call('add_to_cart', [
    'product_id' => 'prod_abc123',
    'quantity' => 2,
]);
```

## Request Signing

The `Signer` class implements the ia.json HMAC signing algorithm:

```php
use IaJson\Client\Auth\Signer;

// Sign a request
$signature = Signer::sign(
    secret: 'sec_xyz789',
    timestamp: time(),
    body: '{"product_id":"prod_123","quantity":2}',
    algorithm: 'sha256',
);

// Generate all auth headers at once
$headers = Signer::createSignedHeaders(
    apiKey: 'ia_live_abc123',
    secret: 'sec_xyz789',
    body: '{"product_id":"prod_123"}',
    algorithm: 'sha256',
    prefix: 'X-IA-',
);

// Result:
// [
//     'X-IA-Key' => 'ia_live_abc123',
//     'X-IA-Signature' => 'a1b2c3d4...',
//     'X-IA-Timestamp' => '1707753600',
// ]

// Verify an incoming signature (server-side)
$valid = Signer::verify(
    secret: 'sec_xyz789',
    providedSignature: $incomingSignature,
    timestamp: (int) $incomingTimestamp,
    body: $rawRequestBody,
    algorithm: 'sha256',
    maxAgeSeconds: 60,
);
```

## Error Handling

The library throws typed exceptions for different error conditions:

```php
use IaJson\Client\Exceptions\IaJsonException;
use IaJson\Client\Exceptions\AuthenticationException;
use IaJson\Client\Exceptions\RateLimitException;

try {
    $result = $client->call('get_inventory');
} catch (RateLimitException $e) {
    // HTTP 429 - retry after the suggested delay
    $retryAfter = $e->getRetryAfter(); // seconds, or null
    sleep($retryAfter ?? 60);
} catch (AuthenticationException $e) {
    // HTTP 401/403 - invalid key, expired signature, etc.
    echo $e->getErrorCode(); // e.g., "invalid_signature"
} catch (IaJsonException $e) {
    // Any other ia.json error
    echo $e->getMessage();
    echo $e->getErrorCode();
    print_r($e->getErrorDetails());
}
```

## Laravel Integration

This package includes first-class Laravel support with auto-discovery.

### Setup

1. Publish the configuration:

```bash
php artisan vendor:publish --tag=iajson-config
```

2. Add your credentials to `.env`:

```env
IAJSON_DOMAIN=techstore.example.com
IAJSON_API_KEY=ia_live_abc123
IAJSON_SECRET=sec_xyz789

# Optional: OAuth2 credentials
IAJSON_OAUTH_CLIENT_ID=your_client_id
IAJSON_OAUTH_CLIENT_SECRET=your_client_secret

# Optional: Cache TTL in seconds (default: 3600)
IAJSON_CACHE_TTL=3600
```

### Using the Facade

```php
use IaJson\Client\Laravel\Facades\IaJson;

// Call endpoints
$products = IaJson::call('search_products', ['q' => 'laptop']);
$inventory = IaJson::call('get_inventory');

// Inspect the site
$site = IaJson::getSite();
$endpoints = IaJson::getEndpoints('public');
$capabilities = IaJson::getCapabilities();
```

### Dependency Injection

```php
use IaJson\Client\IaJsonClient;

class ProductController extends Controller
{
    public function search(Request $request, IaJsonClient $iajson)
    {
        $results = $iajson->call('search_products', [
            'q' => $request->input('query'),
        ]);

        return response()->json($results);
    }
}
```

### Verifying Incoming AI Agent Requests

If your Laravel application serves as an ia.json-enabled site and receives requests from AI agents, use the `VerifyIaSignature` middleware:

1. Register the middleware alias in your `bootstrap/app.php` (Laravel 11+) or kernel:

```php
// bootstrap/app.php (Laravel 11+)
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'iajson.verify' => \IaJson\Client\Laravel\Middleware\VerifyIaSignature::class,
    ]);
})
```

```php
// app/Http/Kernel.php (Laravel 10)
protected $middlewareAliases = [
    // ...
    'iajson.verify' => \IaJson\Client\Laravel\Middleware\VerifyIaSignature::class,
];
```

2. Apply it to your routes:

```php
Route::middleware('iajson.verify')->prefix('api/v1')->group(function () {
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
});
```

3. Configure the secret resolver in `config/iajson.php`:

```php
// Option A: Static key mapping
'verification' => [
    'keys' => [
        'ia_live_agent1_key' => 'sec_agent1_secret',
        'ia_live_agent2_key' => 'sec_agent2_secret',
    ],
],

// Option B: Custom resolver (e.g., from database)
'verification' => [
    'secret_resolver' => function (string $apiKey): ?string {
        $agent = \App\Models\AiAgent::where('api_key', $apiKey)->first();
        return $agent?->secret;
    },
],
```

The verified API key is available in the request:

```php
public function index(Request $request)
{
    $apiKey = $request->attributes->get('iajson_api_key');
    // Use $apiKey to identify which agent is making the request
}
```

## Configuration Reference

The full `config/iajson.php` supports the following options:

| Key | Env Variable | Description |
|-----|-------------|-------------|
| `domain` | `IAJSON_DOMAIN` | Domain to discover ia.json from |
| `api_key` | `IAJSON_API_KEY` | Agent API key |
| `secret` | `IAJSON_SECRET` | Agent secret |
| `oauth.client_id` | `IAJSON_OAUTH_CLIENT_ID` | OAuth2 client ID |
| `oauth.client_secret` | `IAJSON_OAUTH_CLIENT_SECRET` | OAuth2 client secret |
| `cache_ttl` | `IAJSON_CACHE_TTL` | Spec cache TTL in seconds |
| `verification.algorithm` | `IAJSON_VERIFY_ALGORITHM` | HMAC algorithm for verification |
| `verification.header_prefix` | `IAJSON_VERIFY_HEADER_PREFIX` | Auth header prefix |
| `verification.max_age_seconds` | `IAJSON_VERIFY_MAX_AGE` | Max timestamp age |

## Spec Compliance

This library implements the ia.json v1.0.0 specification:

- Discovery at `/ia.json` and `/.well-known/ia.json`
- Version validation (major version check)
- File size limit enforcement (1 MB)
- All three access levels: `public`, `protected`, `user_required`
- HMAC-SHA256 and HMAC-SHA512 request signing
- Timestamp-based replay attack prevention
- Agent registration and domain verification flow
- OAuth2 with PKCE support
- Structured error responses per the spec format

## License

MIT License. See the [ia.json project](https://github.com/Dandte/ai.json) for the full specification.

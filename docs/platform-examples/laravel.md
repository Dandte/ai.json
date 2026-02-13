# ia.json for Laravel

How to add ia.json support to your Laravel application.

## Quick Setup

### Step 1: Create the Route

In `routes/web.php`:

```php
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Response;

Route::get('/ia.json', function () {
    return Response::json([
        'version' => '1.0.0',
        'site' => [
            'name' => config('app.name'),
            'description' => 'My Laravel application',
            'type' => 'saas',
            'url' => config('app.url'),
            'language' => config('app.locale'),
            'contact' => config('mail.from.address'),
        ],
        'api' => [
            'base_url' => config('app.url') . '/api/v1',
            'public' => [
                'get_status' => [
                    'method' => 'GET',
                    'path' => '/status',
                    'description' => 'Get API status',
                ],
                // Add your public endpoints here
            ],
        ],
        'capabilities' => [
            'read' => true,
        ],
        'metadata' => [
            'spec_version' => '1.0.0',
            'generator' => 'laravel',
        ],
    ], 200, [
        'Cache-Control' => 'public, max-age=3600',
    ]);
});
```

### Step 2: Add Authentication (Optional)

If you want AI agents to register:

```php
// routes/api.php
Route::prefix('ia')->group(function () {
    Route::post('/register', [IaRegistrationController::class, 'register']);
    Route::post('/verify', [IaRegistrationController::class, 'verify']);
});
```

Create the controller:

```php
// app/Http/Controllers/IaRegistrationController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Http;

class IaRegistrationController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:200',
            'domain' => 'required|string|max:255',
            'webhook_url' => 'required|url',
            'contact' => 'required|email',
            'description' => 'nullable|string|max:500',
        ]);

        // Generate verification code
        $code = 'vc_' . Str::random(32);

        // Store pending registration
        cache()->put("ia_verification:{$code}", $validated, now()->addMinutes(10));

        // Send verification to webhook
        Http::post($validated['webhook_url'], [
            'verification_code' => $code,
            'site' => config('app.url'),
            'expires_at' => now()->addMinutes(10)->toISOString(),
        ]);

        return response()->json(['message' => 'Verification sent to webhook']);
    }

    public function verify(Request $request)
    {
        $code = $request->input('verification_code');
        $registration = cache()->pull("ia_verification:{$code}");

        if (!$registration) {
            return response()->json([
                'error' => ['code' => 'invalid_code', 'message' => 'Invalid or expired verification code']
            ], 400);
        }

        // Generate credentials
        $apiKey = 'ia_' . Str::random(32);
        $secret = 'sec_' . Str::random(48);

        // Store the AI agent (use a database model in production)
        // IaAgent::create([...]);

        return response()->json([
            'api_key' => $apiKey,
            'secret' => $secret,
            'expires_at' => now()->addDays(90)->toISOString(),
        ]);
    }
}
```

### Step 3: Verify Signatures with Middleware

Use the `iajson/client` PHP library:

```bash
composer require iajson/client
```

Or create your own middleware:

```php
// app/Http/Middleware/VerifyIaSignature.php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class VerifyIaSignature
{
    public function handle(Request $request, Closure $next)
    {
        $prefix = 'X-IA-';
        $apiKey = $request->header($prefix . 'Key');
        $signature = $request->header($prefix . 'Signature');
        $timestamp = $request->header($prefix . 'Timestamp');

        if (!$apiKey || !$signature || !$timestamp) {
            return response()->json([
                'error' => ['code' => 'missing_auth', 'message' => 'Missing authentication headers']
            ], 401);
        }

        // Check timestamp (60 second window)
        if (abs(time() - (int)$timestamp) > 60) {
            return response()->json([
                'error' => ['code' => 'expired_timestamp', 'message' => 'Request timestamp expired']
            ], 401);
        }

        // Look up secret for this key (use database in production)
        $secret = $this->getSecretForKey($apiKey);
        if (!$secret) {
            return response()->json([
                'error' => ['code' => 'invalid_key', 'message' => 'Invalid API key']
            ], 401);
        }

        // Verify signature
        $body = $request->getContent();
        $signingString = "{$timestamp}.{$body}";
        $expected = hash_hmac('sha256', $signingString, $secret);

        if (!hash_equals($expected, $signature)) {
            return response()->json([
                'error' => ['code' => 'invalid_signature', 'message' => 'Invalid request signature']
            ], 401);
        }

        return $next($request);
    }

    private function getSecretForKey(string $apiKey): ?string
    {
        // Look up in database
        // return IaAgent::where('api_key', $apiKey)->value('secret');
        return null;
    }
}
```

Register the middleware in `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'ia.verify' => \App\Http\Middleware\VerifyIaSignature::class,
    ]);
})
```

Use it on your protected routes:

```php
Route::middleware('ia.verify')->group(function () {
    Route::get('/api/v1/inventory', [InventoryController::class, 'index']);
});
```

## Updating Your ia.json

Update the route to include the protected endpoints and authentication configuration:

```php
Route::get('/ia.json', function () {
    return Response::json([
        'version' => '1.0.0',
        'site' => [
            'name' => config('app.name'),
            'type' => 'saas',
            'url' => config('app.url'),
        ],
        'api' => [
            'base_url' => config('app.url') . '/api/v1',
            'public' => [
                'get_status' => [
                    'method' => 'GET',
                    'path' => '/status',
                    'description' => 'Get API status',
                ],
            ],
            'protected' => [
                'get_inventory' => [
                    'method' => 'GET',
                    'path' => '/inventory',
                    'description' => 'Get inventory levels',
                ],
            ],
        ],
        'auth' => [
            'signed_key' => [
                'register_url' => config('app.url') . '/api/ia/register',
                'algorithm' => 'sha256',
                'header_prefix' => 'X-IA-',
                'key_rotation_days' => 90,
            ],
        ],
        'security' => [
            'https_required' => true,
            'rate_limit' => '1000/hour',
            'verify_signature' => true,
        ],
    ]);
});
```

<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Default Domain
    |--------------------------------------------------------------------------
    |
    | The domain to discover ia.json from when using the IaJson facade
    | without specifying a domain. This is typically the domain of the
    | external service your application interacts with.
    |
    */

    'domain' => env('IAJSON_DOMAIN', ''),

    /*
    |--------------------------------------------------------------------------
    | Agent Credentials
    |--------------------------------------------------------------------------
    |
    | API key and secret received after completing the ia.json registration
    | flow. These are used to sign requests to protected endpoints.
    |
    */

    'api_key' => env('IAJSON_API_KEY', ''),
    'secret' => env('IAJSON_SECRET', ''),

    /*
    |--------------------------------------------------------------------------
    | Agent Information
    |--------------------------------------------------------------------------
    |
    | Information about your AI agent, used during the registration process.
    |
    */

    'agent' => [
        'name' => env('IAJSON_AGENT_NAME', config('app.name', 'Laravel') . ' AI Agent'),
        'domain' => env('IAJSON_AGENT_DOMAIN', ''),
        'webhook_url' => env('IAJSON_AGENT_WEBHOOK_URL', ''),
        'contact' => env('IAJSON_AGENT_CONTACT', ''),
        'description' => env('IAJSON_AGENT_DESCRIPTION', ''),
    ],

    /*
    |--------------------------------------------------------------------------
    | OAuth2 Configuration
    |--------------------------------------------------------------------------
    |
    | OAuth2 client credentials for accessing user_required endpoints.
    |
    */

    'oauth' => [
        'client_id' => env('IAJSON_OAUTH_CLIENT_ID', ''),
        'client_secret' => env('IAJSON_OAUTH_CLIENT_SECRET', ''),
    ],

    /*
    |--------------------------------------------------------------------------
    | Signature Verification (Incoming Requests)
    |--------------------------------------------------------------------------
    |
    | Configuration for verifying incoming AI agent requests to your
    | application. Used by the VerifyIaSignature middleware.
    |
    */

    'verification' => [

        // The HMAC algorithm to use: "sha256" or "sha512"
        'algorithm' => env('IAJSON_VERIFY_ALGORITHM', 'sha256'),

        // Header prefix for incoming ia.json auth headers
        'header_prefix' => env('IAJSON_VERIFY_HEADER_PREFIX', 'X-IA-'),

        // Maximum allowed age of the request timestamp in seconds
        'max_age_seconds' => (int) env('IAJSON_VERIFY_MAX_AGE', 60),

        // Callback or class to resolve the secret for a given API key.
        // Should be a callable(string $apiKey): ?string
        // or null to use a static lookup from the 'keys' array below.
        'secret_resolver' => null,

        // Static key-to-secret mapping for simple setups.
        // Format: ['api_key_1' => 'secret_1', 'api_key_2' => 'secret_2']
        'keys' => [],
    ],

    /*
    |--------------------------------------------------------------------------
    | HTTP Client Options
    |--------------------------------------------------------------------------
    |
    | Options passed to the underlying Guzzle HTTP client.
    |
    */

    'http' => [
        'timeout' => 10,
        'connect_timeout' => 5,
    ],

    /*
    |--------------------------------------------------------------------------
    | Cache
    |--------------------------------------------------------------------------
    |
    | How long to cache the discovered ia.json spec, in seconds.
    | Set to 0 to disable caching.
    |
    */

    'cache_ttl' => (int) env('IAJSON_CACHE_TTL', 3600),

];

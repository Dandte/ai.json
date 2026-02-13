<?php

declare(strict_types=1);

namespace IaJson\Client;

use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;
use IaJson\Client\Auth\OAuth;
use IaJson\Client\Auth\Register;
use IaJson\Client\Auth\Signer;
use IaJson\Client\Exceptions\AuthenticationException;
use IaJson\Client\Exceptions\IaJsonException;
use IaJson\Client\Exceptions\RateLimitException;

/**
 * Main client for interacting with ia.json-enabled websites.
 *
 * Usage:
 *   $client = IaJsonClient::discover('example.com');
 *   $results = $client->call('search_products', ['q' => 'laptop']);
 */
class IaJsonClient
{
    /** @var array<string, mixed> The parsed ia.json data. */
    private array $spec;

    private ClientInterface $httpClient;

    private ?string $apiKey = null;

    private ?string $secret = null;

    private ?OAuth $oauth = null;

    private ?string $oauthToken = null;

    /**
     * @param array<string, mixed>   $spec       The parsed ia.json data.
     * @param ClientInterface|null   $httpClient Optional Guzzle client instance.
     */
    public function __construct(array $spec, ?ClientInterface $httpClient = null)
    {
        $this->spec = $spec;
        $this->httpClient = $httpClient ?? new GuzzleClient();
    }

    /**
     * Discover and create a client for the given domain.
     *
     * Fetches the ia.json file from the domain and returns a configured client.
     *
     * @param string               $domain     The domain to discover (e.g., "example.com").
     * @param ClientInterface|null $httpClient Optional Guzzle client for HTTP requests.
     *
     * @throws IaJsonException If discovery fails.
     */
    public static function discover(string $domain, ?ClientInterface $httpClient = null): self
    {
        $client = $httpClient ?? new GuzzleClient();
        $discovery = new Discovery($client);
        $spec = $discovery->fetch($domain);

        return new self($spec, $client);
    }

    /**
     * Register this AI agent with the site using the signed_key flow.
     *
     * Sends a registration request to the site's register_url. After calling
     * this method, you must handle the verification callback and call verify().
     *
     * @param array{
     *     name: string,
     *     domain: string,
     *     webhook_url: string,
     *     contact: string,
     *     description?: string,
     * } $agentInfo Agent information for registration.
     *
     * @return array<string, mixed> The registration response.
     *
     * @throws IaJsonException If registration is not supported or fails.
     */
    public function register(array $agentInfo): array
    {
        $signedKey = $this->getSignedKeyConfig();
        $register = new Register($this->httpClient);

        return $register->register($signedKey['register_url'], $agentInfo);
    }

    /**
     * Complete the registration by submitting the verification code.
     *
     * @param string      $verificationCode The code received at the webhook.
     * @param string|null $verifyUrl        Optional custom verify URL. Auto-derived if not provided.
     *
     * @return array{api_key: string, secret: string, expires_at?: string, permissions?: string[]}
     *
     * @throws IaJsonException If verification fails.
     */
    public function verify(string $verificationCode, ?string $verifyUrl = null): array
    {
        $signedKey = $this->getSignedKeyConfig();
        $register = new Register($this->httpClient);

        $url = $verifyUrl ?? Register::deriveVerifyUrl($signedKey['register_url']);
        $credentials = $register->verify($url, $verificationCode);

        // Store the credentials for subsequent requests
        $this->setCredentials($credentials['api_key'], $credentials['secret']);

        return $credentials;
    }

    /**
     * Set the API key and secret for authenticated requests.
     *
     * Use this if you already have credentials from a previous registration.
     */
    public function setCredentials(string $apiKey, string $secret): void
    {
        $this->apiKey = $apiKey;
        $this->secret = $secret;
    }

    /**
     * Set an OAuth2 access token for user_required endpoint calls.
     */
    public function setOAuthToken(string $token): void
    {
        $this->oauthToken = $token;
    }

    /**
     * Get the OAuth2 helper for managing user authorization.
     *
     * @param string $clientId     Your application's OAuth2 client ID.
     * @param string $clientSecret Your application's OAuth2 client secret.
     *
     * @throws IaJsonException If the site does not support OAuth2.
     */
    public function getOAuth(string $clientId, string $clientSecret = ''): OAuth
    {
        if ($this->oauth !== null) {
            return $this->oauth;
        }

        $oauthConfig = $this->spec['auth']['oauth2'] ?? null;

        if ($oauthConfig === null) {
            throw new IaJsonException(
                message: 'This site does not support OAuth2 authentication',
                errorCode: 'oauth_not_supported',
            );
        }

        $this->oauth = new OAuth(
            httpClient: $this->httpClient,
            authorizationUrl: $oauthConfig['authorization_url'],
            tokenUrl: $oauthConfig['token_url'],
            clientId: $clientId,
            clientSecret: $clientSecret,
            pkceRequired: $oauthConfig['pkce_required'] ?? false,
        );

        return $this->oauth;
    }

    /**
     * Call an API endpoint by name.
     *
     * Resolves the endpoint from the ia.json spec, applies authentication
     * headers as needed, and returns the parsed response.
     *
     * @param string               $endpointName The snake_case endpoint name (e.g., "search_products").
     * @param array<string, mixed> $params       Parameters: used for query params, path params, or body.
     *
     * @return array<string, mixed> The parsed JSON response.
     *
     * @throws IaJsonException            On API errors or missing endpoints.
     * @throws AuthenticationException    On authentication failures.
     * @throws RateLimitException         On rate limit violations (HTTP 429).
     */
    public function call(string $endpointName, array $params = []): array
    {
        $endpoint = $this->resolveEndpoint($endpointName);
        $level = $endpoint['_level'];
        $method = strtoupper($endpoint['method']);
        $path = $endpoint['path'];
        $baseUrl = $this->spec['api']['base_url'];

        // Substitute path parameters
        $path = $this->substitutePath($path, $params);

        $url = rtrim($baseUrl, '/') . '/' . ltrim($path, '/');

        // Build request options
        $options = [
            'headers' => [
                'Accept' => 'application/json',
                'User-Agent' => 'iajson-php/1.0.0',
            ],
            'http_errors' => false,
        ];

        // Determine body vs query params
        $bodyMethods = ['POST', 'PUT', 'PATCH'];
        $body = '';

        if (in_array($method, $bodyMethods, true) && !empty($params)) {
            $body = json_encode($params, JSON_THROW_ON_ERROR);
            $options['headers']['Content-Type'] = 'application/json';
            $options['body'] = $body;
        } elseif ($method === 'GET' && !empty($params)) {
            $options['query'] = $params;
        }

        // Apply authentication headers based on access level
        $this->applyAuth($options, $level, $body);

        // Execute request
        try {
            $response = $this->httpClient->request($method, $url, $options);
        } catch (GuzzleException $e) {
            throw new IaJsonException(
                message: "Request to {$endpointName} failed: " . $e->getMessage(),
                code: $e->getCode(),
                previous: $e,
                errorCode: 'request_failed',
            );
        }

        $statusCode = $response->getStatusCode();
        $responseBody = (string) $response->getBody();

        $data = [];
        if ($responseBody !== '') {
            try {
                $data = json_decode($responseBody, true, 512, JSON_THROW_ON_ERROR);
                if (!is_array($data)) {
                    $data = ['data' => $data];
                }
            } catch (\JsonException) {
                $data = ['raw' => $responseBody];
            }
        }

        // Handle error responses
        if ($statusCode >= 400) {
            $this->handleErrorResponse($statusCode, $data, $response->getHeaders());
        }

        return $data;
    }

    /**
     * Get all endpoints, optionally filtered by access level.
     *
     * @param string|null $level One of: "public", "protected", "user_required", or null for all.
     *
     * @return array<string, array<string, mixed>> Endpoint name => endpoint definition.
     */
    public function getEndpoints(?string $level = null): array
    {
        $api = $this->spec['api'] ?? [];
        $levels = ['public', 'protected', 'user_required'];

        if ($level !== null) {
            if (!in_array($level, $levels, true)) {
                throw new IaJsonException(
                    message: "Invalid access level: {$level}. Must be one of: "
                        . implode(', ', $levels),
                    errorCode: 'invalid_level',
                );
            }

            $endpoints = $api[$level] ?? [];
            $result = [];
            foreach ($endpoints as $name => $endpoint) {
                $result[$name] = array_merge($endpoint, ['_level' => $level]);
            }

            return $result;
        }

        // Return all endpoints across all levels
        $result = [];
        foreach ($levels as $lvl) {
            foreach ($api[$lvl] ?? [] as $name => $endpoint) {
                $result[$name] = array_merge($endpoint, ['_level' => $lvl]);
            }
        }

        return $result;
    }

    /**
     * Get the parsed ia.json spec data.
     *
     * @return array<string, mixed>
     */
    public function getSpec(): array
    {
        return $this->spec;
    }

    /**
     * Get site metadata from the ia.json spec.
     *
     * @return array<string, mixed>
     */
    public function getSite(): array
    {
        return $this->spec['site'] ?? [];
    }

    /**
     * Get the declared capabilities.
     *
     * @return array<string, bool>
     */
    public function getCapabilities(): array
    {
        return $this->spec['capabilities'] ?? [];
    }

    /**
     * Check if the site declares a specific capability.
     */
    public function hasCapability(string $capability): bool
    {
        return ($this->spec['capabilities'][$capability] ?? false) === true;
    }

    /**
     * Get the security configuration.
     *
     * @return array<string, mixed>
     */
    public function getSecurity(): array
    {
        return $this->spec['security'] ?? [];
    }

    /**
     * Get the global rate limit string (e.g. "1000/hour").
     */
    public function getRateLimit(): ?string
    {
        return $this->spec['security']['rate_limit'] ?? null;
    }

    /**
     * Get declared webhook events.
     *
     * @return array<string, array<string, mixed>>
     */
    public function getWebhooks(): array
    {
        return $this->spec['webhooks'] ?? [];
    }

    /**
     * Get the API base URL.
     */
    public function getBaseUrl(): string
    {
        return $this->spec['api']['base_url'];
    }

    /**
     * Get the auth configuration.
     *
     * @return array<string, mixed>
     */
    public function getAuth(): array
    {
        return $this->spec['auth'] ?? [];
    }

    /**
     * Resolve an endpoint by name across all access levels.
     *
     * @return array<string, mixed> The endpoint definition with an added '_level' key.
     *
     * @throws IaJsonException If the endpoint is not found.
     */
    private function resolveEndpoint(string $name): array
    {
        $levels = ['public', 'protected', 'user_required'];

        foreach ($levels as $level) {
            $endpoints = $this->spec['api'][$level] ?? [];
            if (isset($endpoints[$name])) {
                return array_merge($endpoints[$name], ['_level' => $level]);
            }
        }

        throw new IaJsonException(
            message: "Endpoint not found: {$name}. "
                . 'Available endpoints: ' . implode(', ', array_keys($this->getEndpoints())),
            errorCode: 'endpoint_not_found',
        );
    }

    /**
     * Substitute path parameters (e.g., /products/{id}) with actual values.
     *
     * Parameters used for path substitution are removed from the params array.
     *
     * @param array<string, mixed> &$params Modified in place to remove used path params.
     */
    private function substitutePath(string $path, array &$params): string
    {
        return (string) preg_replace_callback(
            '/\{(\w+)\}/',
            function (array $matches) use (&$params): string {
                $paramName = $matches[1];
                if (!array_key_exists($paramName, $params)) {
                    throw new IaJsonException(
                        message: "Missing required path parameter: {$paramName}",
                        errorCode: 'missing_parameter',
                    );
                }
                $value = (string) $params[$paramName];
                unset($params[$paramName]);

                return rawurlencode($value);
            },
            $path,
        );
    }

    /**
     * Apply authentication headers based on the endpoint's access level.
     *
     * @param array<string, mixed> &$options Guzzle request options (modified in place).
     * @param string               $level    Access level: public, protected, or user_required.
     * @param string               $body     The serialized request body.
     */
    private function applyAuth(array &$options, string $level, string $body): void
    {
        if ($level === 'public') {
            return;
        }

        // Protected and user_required both need signed_key auth
        if ($level === 'protected' || $level === 'user_required') {
            if ($this->apiKey === null || $this->secret === null) {
                throw AuthenticationException::missingCredentials();
            }

            $signedKeyConfig = $this->spec['auth']['signed_key'] ?? null;
            $algorithm = $signedKeyConfig['algorithm'] ?? 'sha256';
            $prefix = $signedKeyConfig['header_prefix'] ?? 'X-IA-';

            $signedHeaders = Signer::createSignedHeaders(
                apiKey: $this->apiKey,
                secret: $this->secret,
                body: $body,
                algorithm: $algorithm,
                prefix: $prefix,
            );

            $options['headers'] = array_merge($options['headers'], $signedHeaders);
        }

        // user_required also needs an OAuth Bearer token
        if ($level === 'user_required') {
            $token = $this->oauthToken;

            // Try to get token from OAuth helper if available
            if ($token === null && $this->oauth !== null) {
                try {
                    $token = $this->oauth->getAccessToken();
                } catch (AuthenticationException) {
                    // Let it fall through to the check below
                }
            }

            if ($token === null) {
                throw AuthenticationException::missingOAuthToken();
            }

            $options['headers']['Authorization'] = 'Bearer ' . $token;
        }
    }

    /**
     * Handle HTTP error responses by throwing appropriate exceptions.
     *
     * @param int                  $statusCode HTTP status code.
     * @param array<string, mixed> $body       Parsed response body.
     * @param array<string, string|string[]> $headers Response headers.
     *
     * @throws AuthenticationException On 401/403 errors.
     * @throws RateLimitException      On 429 errors.
     * @throws IaJsonException         On other errors.
     */
    private function handleErrorResponse(int $statusCode, array $body, array $headers): void
    {
        $errorCode = $body['error']['code'] ?? null;

        if ($statusCode === 429) {
            throw RateLimitException::fromResponseWithHeaders($body, $headers);
        }

        if ($statusCode === 401 || $statusCode === 403) {
            throw AuthenticationException::fromResponse($body, $statusCode);
        }

        throw IaJsonException::fromResponse($body, $statusCode);
    }

    /**
     * Get the signed_key auth configuration, or throw if not present.
     *
     * @return array<string, mixed>
     *
     * @throws IaJsonException If signed_key auth is not configured.
     */
    private function getSignedKeyConfig(): array
    {
        $signedKey = $this->spec['auth']['signed_key'] ?? null;

        if ($signedKey === null) {
            throw new IaJsonException(
                message: 'This site does not support signed_key authentication. '
                    . 'Check the auth section of the ia.json spec.',
                errorCode: 'signed_key_not_supported',
            );
        }

        return $signedKey;
    }
}

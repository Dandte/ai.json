<?php

declare(strict_types=1);

namespace IaJson\Client\Auth;

use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;
use IaJson\Client\Exceptions\AuthenticationException;
use IaJson\Client\Exceptions\IaJsonException;

/**
 * OAuth2 helper for ia.json user_required endpoint authentication.
 *
 * Supports authorization_code and client_credentials grant types
 * with optional PKCE (Proof Key for Code Exchange).
 */
class OAuth
{
    private ?string $accessToken = null;

    private ?string $refreshToken = null;

    private ?int $expiresAt = null;

    public function __construct(
        private readonly ClientInterface $httpClient,
        private readonly string $authorizationUrl,
        private readonly string $tokenUrl,
        private readonly string $clientId,
        private readonly string $clientSecret = '',
        private readonly bool $pkceRequired = false,
    ) {
    }

    /**
     * Build the authorization URL for the user to visit.
     *
     * @param string   $redirectUri The URI to redirect back to after authorization.
     * @param string[] $scopes      The OAuth2 scopes to request.
     * @param string   $state       An opaque CSRF-prevention value.
     *
     * @return array{url: string, code_verifier?: string}
     *     The authorization URL and, if PKCE is enabled, the code_verifier to store.
     */
    public function getAuthorizationUrl(
        string $redirectUri,
        array $scopes = [],
        string $state = '',
    ): array {
        $params = [
            'response_type' => 'code',
            'client_id' => $this->clientId,
            'redirect_uri' => $redirectUri,
            'state' => $state ?: bin2hex(random_bytes(16)),
        ];

        if (!empty($scopes)) {
            $params['scope'] = implode(' ', $scopes);
        }

        $result = [];

        if ($this->pkceRequired) {
            $codeVerifier = $this->generateCodeVerifier();
            $codeChallenge = $this->generateCodeChallenge($codeVerifier);

            $params['code_challenge'] = $codeChallenge;
            $params['code_challenge_method'] = 'S256';

            $result['code_verifier'] = $codeVerifier;
        }

        $result['url'] = $this->authorizationUrl . '?' . http_build_query($params);

        return $result;
    }

    /**
     * Exchange an authorization code for access and refresh tokens.
     *
     * @param string      $code         The authorization code received from the callback.
     * @param string      $redirectUri  The same redirect URI used in the authorization request.
     * @param string|null $codeVerifier The PKCE code verifier (required if PKCE is enabled).
     *
     * @return array{access_token: string, refresh_token?: string, expires_in?: int, token_type: string, scope?: string}
     *
     * @throws IaJsonException On token exchange failure.
     */
    public function exchangeCode(
        string $code,
        string $redirectUri,
        ?string $codeVerifier = null,
    ): array {
        $params = [
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => $redirectUri,
            'client_id' => $this->clientId,
        ];

        if ($this->clientSecret !== '') {
            $params['client_secret'] = $this->clientSecret;
        }

        if ($this->pkceRequired) {
            if ($codeVerifier === null) {
                throw new IaJsonException(
                    message: 'PKCE is required but no code_verifier was provided',
                    errorCode: 'pkce_required',
                );
            }
            $params['code_verifier'] = $codeVerifier;
        }

        return $this->requestToken($params);
    }

    /**
     * Obtain tokens using the client_credentials grant type.
     *
     * @param string[] $scopes The OAuth2 scopes to request.
     *
     * @return array{access_token: string, expires_in?: int, token_type: string, scope?: string}
     *
     * @throws IaJsonException On token request failure.
     */
    public function clientCredentials(array $scopes = []): array
    {
        $params = [
            'grant_type' => 'client_credentials',
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
        ];

        if (!empty($scopes)) {
            $params['scope'] = implode(' ', $scopes);
        }

        return $this->requestToken($params);
    }

    /**
     * Refresh the access token using a refresh token.
     *
     * @param string|null $refreshToken The refresh token. Uses the stored one if not provided.
     *
     * @return array{access_token: string, refresh_token?: string, expires_in?: int, token_type: string}
     *
     * @throws IaJsonException On refresh failure.
     */
    public function refreshAccessToken(?string $refreshToken = null): array
    {
        $token = $refreshToken ?? $this->refreshToken;

        if ($token === null) {
            throw AuthenticationException::missingOAuthToken();
        }

        $params = [
            'grant_type' => 'refresh_token',
            'refresh_token' => $token,
            'client_id' => $this->clientId,
        ];

        if ($this->clientSecret !== '') {
            $params['client_secret'] = $this->clientSecret;
        }

        return $this->requestToken($params);
    }

    /**
     * Get the current access token, refreshing if expired.
     *
     * @throws AuthenticationException If no access token is available.
     */
    public function getAccessToken(): string
    {
        if ($this->accessToken === null) {
            throw AuthenticationException::missingOAuthToken();
        }

        // Auto-refresh if expired and we have a refresh token
        if ($this->isExpired() && $this->refreshToken !== null) {
            $this->refreshAccessToken();
        }

        return $this->accessToken;
    }

    /**
     * Manually set tokens (e.g. loaded from storage).
     */
    public function setTokens(
        string $accessToken,
        ?string $refreshToken = null,
        ?int $expiresIn = null,
    ): void {
        $this->accessToken = $accessToken;
        $this->refreshToken = $refreshToken;
        $this->expiresAt = $expiresIn !== null ? time() + $expiresIn : null;
    }

    /**
     * Check whether the current access token has expired.
     */
    public function isExpired(): bool
    {
        if ($this->expiresAt === null) {
            return false;
        }

        // Add a small buffer to account for clock skew
        return time() >= ($this->expiresAt - 30);
    }

    /**
     * Send a token request to the token endpoint.
     *
     * @param array<string, string> $params
     *
     * @return array<string, mixed>
     *
     * @throws IaJsonException On failure.
     */
    private function requestToken(array $params): array
    {
        try {
            $response = $this->httpClient->request('POST', $this->tokenUrl, [
                'form_params' => $params,
                'headers' => [
                    'Accept' => 'application/json',
                ],
            ]);

            $body = json_decode((string) $response->getBody(), true);

            if (!is_array($body) || empty($body['access_token'])) {
                throw new IaJsonException(
                    message: 'Invalid token response from OAuth2 server',
                    errorCode: 'invalid_token_response',
                );
            }

            // Store tokens internally
            $this->accessToken = $body['access_token'];
            $this->refreshToken = $body['refresh_token'] ?? $this->refreshToken;
            $this->expiresAt = isset($body['expires_in'])
                ? time() + (int) $body['expires_in']
                : null;

            return $body;
        } catch (GuzzleException $e) {
            throw new IaJsonException(
                message: 'OAuth2 token request failed: ' . $e->getMessage(),
                code: $e->getCode(),
                previous: $e,
                errorCode: 'oauth_token_failed',
            );
        }
    }

    /**
     * Generate a cryptographically random PKCE code verifier.
     *
     * Per RFC 7636, the verifier is 43-128 characters from [A-Z, a-z, 0-9, -, ., _, ~].
     */
    private function generateCodeVerifier(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    /**
     * Generate a PKCE code challenge from a code verifier using S256.
     */
    private function generateCodeChallenge(string $codeVerifier): string
    {
        $hash = hash('sha256', $codeVerifier, true);

        return rtrim(strtr(base64_encode($hash), '+/', '-_'), '=');
    }
}

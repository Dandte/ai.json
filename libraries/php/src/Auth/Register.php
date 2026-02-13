<?php

declare(strict_types=1);

namespace IaJson\Client\Auth;

use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;
use IaJson\Client\Exceptions\AuthenticationException;
use IaJson\Client\Exceptions\IaJsonException;

/**
 * Handles the AI agent registration flow with ia.json sites.
 *
 * Registration follows these steps per the spec:
 * 1. POST to register_url with agent info
 * 2. Site sends verification_code to the agent's webhook_url
 * 3. Agent sends verification_code back to verify endpoint
 * 4. Site responds with api_key and secret
 */
class Register
{
    public function __construct(
        private readonly ClientInterface $httpClient,
    ) {
    }

    /**
     * Step 1: Send a registration request to the site.
     *
     * @param string $registerUrl The registration URL from ia.json auth.signed_key.register_url
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
     * @throws IaJsonException On registration failure.
     */
    public function register(string $registerUrl, array $agentInfo): array
    {
        $requiredFields = ['name', 'domain', 'webhook_url', 'contact'];
        foreach ($requiredFields as $field) {
            if (empty($agentInfo[$field])) {
                throw new IaJsonException(
                    message: "Missing required registration field: {$field}",
                    errorCode: 'invalid_registration',
                );
            }
        }

        try {
            $response = $this->httpClient->request('POST', $registerUrl, [
                'json' => $agentInfo,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ],
            ]);

            $body = json_decode((string) $response->getBody(), true);

            if (!is_array($body)) {
                throw new IaJsonException(
                    message: 'Invalid registration response: expected JSON object',
                    errorCode: 'invalid_response',
                );
            }

            return $body;
        } catch (GuzzleException $e) {
            throw new IaJsonException(
                message: 'Registration request failed: ' . $e->getMessage(),
                code: $e->getCode(),
                previous: $e,
                errorCode: 'registration_failed',
            );
        }
    }

    /**
     * Step 3: Submit the verification code received via webhook.
     *
     * After the site sends a verification code to the agent's webhook_url,
     * the agent must echo it back to confirm domain ownership.
     *
     * @param string $verifyUrl  The verification URL (typically register_url with /verify path).
     * @param string $verificationCode The code received at the webhook.
     *
     * @return array{api_key: string, secret: string, expires_at?: string, permissions?: string[]}
     *     The issued credentials.
     *
     * @throws AuthenticationException If verification fails.
     * @throws IaJsonException On other failures.
     */
    public function verify(string $verifyUrl, string $verificationCode): array
    {
        try {
            $response = $this->httpClient->request('POST', $verifyUrl, [
                'json' => [
                    'verification_code' => $verificationCode,
                ],
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ],
            ]);

            $statusCode = $response->getStatusCode();
            $body = json_decode((string) $response->getBody(), true);

            if (!is_array($body)) {
                throw new IaJsonException(
                    message: 'Invalid verification response: expected JSON object',
                    errorCode: 'invalid_response',
                );
            }

            if ($statusCode >= 400) {
                throw IaJsonException::fromResponse($body, $statusCode);
            }

            if (empty($body['api_key']) || empty($body['secret'])) {
                throw new IaJsonException(
                    message: 'Verification response missing api_key or secret',
                    errorCode: 'invalid_response',
                );
            }

            return $body;
        } catch (GuzzleException $e) {
            throw new IaJsonException(
                message: 'Verification request failed: ' . $e->getMessage(),
                code: $e->getCode(),
                previous: $e,
                errorCode: 'verification_failed',
            );
        }
    }

    /**
     * Derive the verify URL from the register URL.
     *
     * Convention: replace the last path segment with "verify".
     * e.g., https://example.com/ia/register -> https://example.com/ia/verify
     */
    public static function deriveVerifyUrl(string $registerUrl): string
    {
        $parts = parse_url($registerUrl);
        if ($parts === false || !isset($parts['scheme'], $parts['host'])) {
            throw new IaJsonException(
                message: 'Invalid register URL: ' . $registerUrl,
                errorCode: 'invalid_url',
            );
        }

        $path = $parts['path'] ?? '/';
        $pathSegments = explode('/', rtrim($path, '/'));
        array_pop($pathSegments);
        $pathSegments[] = 'verify';

        $port = isset($parts['port']) ? ':' . $parts['port'] : '';

        return $parts['scheme'] . '://' . $parts['host'] . $port . implode('/', $pathSegments);
    }
}

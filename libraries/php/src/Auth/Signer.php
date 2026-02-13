<?php

declare(strict_types=1);

namespace IaJson\Client\Auth;

/**
 * Handles request signing for ia.json signed_key authentication.
 *
 * Implements the HMAC-based signing algorithm defined in the ia.json spec:
 * 1. Build signing string: "{timestamp}.{body}"
 * 2. Compute HMAC using the configured algorithm (sha256 or sha512)
 * 3. Return hex-encoded signature
 */
class Signer
{
    /**
     * Generate an HMAC signature for a request.
     *
     * @param string $secret    The shared secret issued during registration.
     * @param int    $timestamp Unix timestamp in seconds.
     * @param string $body      The request body (empty string for GET requests).
     * @param string $algorithm The HMAC algorithm: "sha256" or "sha512".
     *
     * @return string Hex-encoded HMAC signature.
     */
    public static function sign(
        string $secret,
        int $timestamp,
        string $body,
        string $algorithm = 'sha256',
    ): string {
        $signingString = self::buildSigningString($timestamp, $body);

        return hash_hmac($algorithm, $signingString, $secret);
    }

    /**
     * Build the signing string per the ia.json spec: "{timestamp}.{body}".
     *
     * For GET requests with no body, the result is "{timestamp}." (trailing dot).
     */
    public static function buildSigningString(int $timestamp, string $body): string
    {
        return $timestamp . '.' . $body;
    }

    /**
     * Create a complete set of signed authentication headers.
     *
     * Returns an associative array with the three required headers:
     * - {prefix}Key: The API key
     * - {prefix}Signature: The computed HMAC signature
     * - {prefix}Timestamp: The Unix timestamp
     *
     * @param string $apiKey    The API key issued during registration.
     * @param string $secret    The shared secret issued during registration.
     * @param string $body      The request body (empty string for GET requests).
     * @param string $algorithm The HMAC algorithm: "sha256" or "sha512".
     * @param string $prefix    The header prefix (default: "X-IA-").
     *
     * @return array<string, string> Associative array of header name => value.
     */
    public static function createSignedHeaders(
        string $apiKey,
        string $secret,
        string $body,
        string $algorithm = 'sha256',
        string $prefix = 'X-IA-',
    ): array {
        $timestamp = time();
        $signature = self::sign($secret, $timestamp, $body, $algorithm);

        return [
            $prefix . 'Key' => $apiKey,
            $prefix . 'Signature' => $signature,
            $prefix . 'Timestamp' => (string) $timestamp,
        ];
    }

    /**
     * Verify an incoming request signature.
     *
     * Useful for server-side verification of AI agent requests.
     *
     * @param string $secret           The shared secret for the agent.
     * @param string $providedSignature The signature from the request header.
     * @param int    $timestamp         The timestamp from the request header.
     * @param string $body              The raw request body.
     * @param string $algorithm         The HMAC algorithm: "sha256" or "sha512".
     * @param int    $maxAgeSeconds     Maximum allowed age of the timestamp (default: 60).
     *
     * @return bool True if the signature is valid and timestamp is within range.
     */
    public static function verify(
        string $secret,
        string $providedSignature,
        int $timestamp,
        string $body,
        string $algorithm = 'sha256',
        int $maxAgeSeconds = 60,
    ): bool {
        // Check timestamp freshness
        $now = time();
        if (abs($now - $timestamp) > $maxAgeSeconds) {
            return false;
        }

        // Compute expected signature
        $expectedSignature = self::sign($secret, $timestamp, $body, $algorithm);

        // Constant-time comparison to prevent timing attacks
        return hash_equals($expectedSignature, $providedSignature);
    }
}

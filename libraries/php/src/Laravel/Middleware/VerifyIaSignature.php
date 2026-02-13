<?php

declare(strict_types=1);

namespace IaJson\Client\Laravel\Middleware;

use Closure;
use IaJson\Client\Auth\Signer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Laravel middleware that verifies incoming AI agent request signatures.
 *
 * This middleware validates the ia.json signed_key authentication headers
 * on incoming requests, ensuring they come from a registered AI agent
 * with a valid, non-expired signature.
 *
 * Usage in routes:
 *   Route::middleware('iajson.verify')->group(function () {
 *       Route::post('/api/v1/orders', [OrderController::class, 'store']);
 *   });
 *
 * Register in your kernel or route service provider:
 *   'iajson.verify' => \IaJson\Client\Laravel\Middleware\VerifyIaSignature::class,
 */
class VerifyIaSignature
{
    /**
     * Handle an incoming request.
     *
     * @param Closure(Request): Response $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var array<string, mixed> $config */
        $config = config('iajson.verification', []);

        $prefix = $config['header_prefix'] ?? 'X-IA-';
        $algorithm = $config['algorithm'] ?? 'sha256';
        $maxAge = $config['max_age_seconds'] ?? 60;

        // Extract authentication headers
        $apiKey = $request->header($prefix . 'Key');
        $signature = $request->header($prefix . 'Signature');
        $timestamp = $request->header($prefix . 'Timestamp');

        // Validate presence of all required headers
        if ($apiKey === null || $signature === null || $timestamp === null) {
            return $this->errorResponse(
                'Missing required authentication headers',
                'missing_auth_headers',
                401,
            );
        }

        // Validate timestamp is numeric
        if (!is_numeric($timestamp)) {
            return $this->errorResponse(
                'Invalid timestamp format',
                'invalid_timestamp',
                401,
            );
        }

        $timestampInt = (int) $timestamp;

        // Resolve the secret for this API key
        $secret = $this->resolveSecret($apiKey, $config);

        if ($secret === null) {
            return $this->errorResponse(
                'The API key is invalid or has been revoked',
                'invalid_key',
                401,
            );
        }

        // Get the raw request body
        $body = $request->getContent();

        // Verify the signature
        $isValid = Signer::verify(
            secret: $secret,
            providedSignature: $signature,
            timestamp: $timestampInt,
            body: $body,
            algorithm: $algorithm,
            maxAgeSeconds: $maxAge,
        );

        if (!$isValid) {
            // Determine if it is a timestamp issue or a signature issue
            $now = time();
            if (abs($now - $timestampInt) > $maxAge) {
                return $this->errorResponse(
                    'The request timestamp has expired',
                    'expired_timestamp',
                    401,
                );
            }

            return $this->errorResponse(
                'The request signature is invalid',
                'invalid_signature',
                401,
            );
        }

        // Attach the verified API key to the request for downstream use
        $request->attributes->set('iajson_api_key', $apiKey);

        return $next($request);
    }

    /**
     * Resolve the secret for a given API key using the configured resolver.
     *
     * @param array<string, mixed> $config
     */
    private function resolveSecret(string $apiKey, array $config): ?string
    {
        // Try custom resolver first
        $resolver = $config['secret_resolver'] ?? null;
        if ($resolver !== null && is_callable($resolver)) {
            return $resolver($apiKey);
        }

        // Fall back to static key mapping
        $keys = $config['keys'] ?? [];

        return $keys[$apiKey] ?? null;
    }

    /**
     * Return a JSON error response in the ia.json error format.
     */
    private function errorResponse(string $message, string $code, int $status): JsonResponse
    {
        return new JsonResponse(
            data: [
                'error' => [
                    'code' => $code,
                    'message' => $message,
                    'details' => new \stdClass(),
                ],
            ],
            status: $status,
            headers: ['Content-Type' => 'application/json'],
        );
    }
}

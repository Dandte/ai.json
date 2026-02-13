<?php

declare(strict_types=1);

namespace IaJson\Client\Exceptions;

/**
 * Exception thrown when a rate limit is exceeded (HTTP 429).
 */
class RateLimitException extends IaJsonException
{
    protected ?int $retryAfter;

    public function __construct(
        string $message = 'Rate limit exceeded',
        ?int $retryAfter = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct(
            message: $message,
            code: 429,
            previous: $previous,
            errorCode: 'rate_limit_exceeded',
        );
        $this->retryAfter = $retryAfter;
    }

    /**
     * Create from an HTTP response with optional Retry-After header.
     *
     * @param array<string, mixed> $responseBody
     * @param array<string, string|string[]> $headers
     */
    public static function fromResponseWithHeaders(
        array $responseBody,
        array $headers = [],
    ): self {
        $error = $responseBody['error'] ?? [];
        $message = $error['message'] ?? 'Rate limit exceeded';

        $retryAfter = null;
        $retryHeader = $headers['Retry-After'] ?? $headers['retry-after'] ?? null;
        if ($retryHeader !== null) {
            $retryAfter = (int) (is_array($retryHeader) ? $retryHeader[0] : $retryHeader);
        }

        return new self(
            message: $message,
            retryAfter: $retryAfter,
        );
    }

    /**
     * Get the number of seconds to wait before retrying, if provided.
     */
    public function getRetryAfter(): ?int
    {
        return $this->retryAfter;
    }
}

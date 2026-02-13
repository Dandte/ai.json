<?php

declare(strict_types=1);

namespace IaJson\Client\Exceptions;

use RuntimeException;

/**
 * Base exception for all ia.json client errors.
 */
class IaJsonException extends RuntimeException
{
    protected ?string $errorCode;

    /** @var array<string, mixed> */
    protected array $errorDetails;

    /**
     * @param array<string, mixed> $errorDetails
     */
    public function __construct(
        string $message = '',
        int $code = 0,
        ?\Throwable $previous = null,
        ?string $errorCode = null,
        array $errorDetails = [],
    ) {
        parent::__construct($message, $code, $previous);
        $this->errorCode = $errorCode;
        $this->errorDetails = $errorDetails;
    }

    /**
     * Create an exception from an ia.json error response body.
     *
     * @param array<string, mixed> $responseBody
     */
    public static function fromResponse(array $responseBody, int $httpStatus = 0): static
    {
        $error = $responseBody['error'] ?? [];
        $errorCode = $error['code'] ?? null;
        $message = $error['message'] ?? 'Unknown ia.json error';
        $details = $error['details'] ?? [];

        return new static(
            message: $message,
            code: $httpStatus,
            errorCode: $errorCode,
            errorDetails: is_array($details) ? $details : [],
        );
    }

    /**
     * Get the ia.json error code (e.g. "invalid_key", "rate_limit_exceeded").
     */
    public function getErrorCode(): ?string
    {
        return $this->errorCode;
    }

    /**
     * Get additional error details from the response.
     *
     * @return array<string, mixed>
     */
    public function getErrorDetails(): array
    {
        return $this->errorDetails;
    }
}

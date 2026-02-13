<?php

declare(strict_types=1);

namespace IaJson\Client\Exceptions;

/**
 * Exception thrown when authentication or authorization fails.
 *
 * Covers ia.json error codes: invalid_key, expired_timestamp,
 * invalid_signature, agent_blocked.
 */
class AuthenticationException extends IaJsonException
{
    /**
     * Create an exception for an invalid API key.
     */
    public static function invalidKey(): self
    {
        return new self(
            message: 'The API key is invalid or has been revoked',
            code: 401,
            errorCode: 'invalid_key',
        );
    }

    /**
     * Create an exception for an expired request timestamp.
     */
    public static function expiredTimestamp(): self
    {
        return new self(
            message: 'The request timestamp has expired',
            code: 401,
            errorCode: 'expired_timestamp',
        );
    }

    /**
     * Create an exception for an invalid request signature.
     */
    public static function invalidSignature(): self
    {
        return new self(
            message: 'The request signature is invalid',
            code: 401,
            errorCode: 'invalid_signature',
        );
    }

    /**
     * Create an exception for a blocked agent.
     */
    public static function agentBlocked(): self
    {
        return new self(
            message: 'This agent has been blocked',
            code: 403,
            errorCode: 'agent_blocked',
        );
    }

    /**
     * Create an exception for missing credentials.
     */
    public static function missingCredentials(): self
    {
        return new self(
            message: 'API key and secret are required. Register first using register().',
            code: 0,
            errorCode: 'missing_credentials',
        );
    }

    /**
     * Create an exception for missing OAuth token.
     */
    public static function missingOAuthToken(): self
    {
        return new self(
            message: 'An OAuth2 access token is required for user_required endpoints',
            code: 0,
            errorCode: 'missing_oauth_token',
        );
    }
}

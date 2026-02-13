<?php

declare(strict_types=1);

namespace IaJson\Client\Laravel\Facades;

use IaJson\Client\Auth\OAuth;
use IaJson\Client\IaJsonClient;
use Illuminate\Support\Facades\Facade;

/**
 * Laravel facade for the ia.json client.
 *
 * @method static array call(string $endpointName, array $params = [])
 * @method static array register(array $agentInfo)
 * @method static array verify(string $verificationCode, ?string $verifyUrl = null)
 * @method static array getEndpoints(?string $level = null)
 * @method static array getSpec()
 * @method static array getSite()
 * @method static array getCapabilities()
 * @method static bool  hasCapability(string $capability)
 * @method static array getSecurity()
 * @method static ?string getRateLimit()
 * @method static array getWebhooks()
 * @method static string getBaseUrl()
 * @method static array getAuth()
 * @method static void  setCredentials(string $apiKey, string $secret)
 * @method static void  setOAuthToken(string $token)
 * @method static OAuth getOAuth(string $clientId, string $clientSecret = '')
 *
 * @see IaJsonClient
 */
class IaJson extends Facade
{
    /**
     * Get the registered name of the component.
     */
    protected static function getFacadeAccessor(): string
    {
        return 'iajson';
    }
}

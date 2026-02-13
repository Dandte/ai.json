<?php

declare(strict_types=1);

namespace IaJson\Client\Laravel;

use GuzzleHttp\Client as GuzzleClient;
use IaJson\Client\IaJsonClient;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\ServiceProvider;

class IaJsonServiceProvider extends ServiceProvider
{
    /**
     * Register the ia.json client services.
     */
    public function register(): void
    {
        $this->mergeConfigFrom(
            __DIR__ . '/config/iajson.php',
            'iajson',
        );

        $this->app->singleton(IaJsonClient::class, function (Application $app): IaJsonClient {
            /** @var array<string, mixed> $config */
            $config = $app['config']['iajson'];

            $httpClient = new GuzzleClient([
                'timeout' => $config['http']['timeout'] ?? 10,
                'connect_timeout' => $config['http']['connect_timeout'] ?? 5,
            ]);

            $domain = $config['domain'] ?? '';

            if ($domain === '') {
                throw new \RuntimeException(
                    'IAJSON_DOMAIN is not configured. '
                    . 'Set it in your .env file or config/iajson.php.',
                );
            }

            // Check cache
            $cacheKey = 'iajson_spec_' . md5($domain);
            $cacheTtl = $config['cache_ttl'] ?? 3600;

            if ($cacheTtl > 0 && $app->has('cache')) {
                /** @var \Illuminate\Contracts\Cache\Repository $cache */
                $cache = $app['cache'];
                $spec = $cache->remember($cacheKey, $cacheTtl, function () use ($domain, $httpClient): array {
                    $discovery = new \IaJson\Client\Discovery($httpClient);

                    return $discovery->fetch($domain);
                });
            } else {
                $discovery = new \IaJson\Client\Discovery($httpClient);
                $spec = $discovery->fetch($domain);
            }

            $client = new IaJsonClient($spec, $httpClient);

            // Set credentials if configured
            $apiKey = $config['api_key'] ?? '';
            $secret = $config['secret'] ?? '';

            if ($apiKey !== '' && $secret !== '') {
                $client->setCredentials($apiKey, $secret);
            }

            return $client;
        });

        $this->app->alias(IaJsonClient::class, 'iajson');
    }

    /**
     * Bootstrap the ia.json services.
     */
    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/config/iajson.php' => $this->app->configPath('iajson.php'),
            ], 'iajson-config');
        }
    }

    /**
     * Get the services provided by the provider.
     *
     * @return string[]
     */
    public function provides(): array
    {
        return [
            IaJsonClient::class,
            'iajson',
        ];
    }
}

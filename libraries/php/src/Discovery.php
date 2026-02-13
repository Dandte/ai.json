<?php

declare(strict_types=1);

namespace IaJson\Client;

use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;
use IaJson\Client\Exceptions\IaJsonException;

/**
 * Discovers and fetches ia.json files from a given domain.
 *
 * Follows the ia.json spec discovery algorithm:
 * 1. Try https://{domain}/ia.json
 * 2. If not found, try https://{domain}/.well-known/ia.json
 * 3. If neither exists, throw an exception
 */
class Discovery
{
    /** @var int Maximum allowed file size in bytes (1 MB per spec). */
    private const MAX_FILE_SIZE = 1_048_576;

    /** @var string The supported major version. */
    private const SUPPORTED_MAJOR_VERSION = '1';

    public function __construct(
        private readonly ClientInterface $httpClient = new GuzzleClient(),
    ) {
    }

    /**
     * Fetch and parse an ia.json file from the given domain.
     *
     * @param string $domain The domain to discover (e.g., "example.com").
     *
     * @return array<string, mixed> The parsed ia.json data.
     *
     * @throws IaJsonException If the file cannot be found, fetched, or parsed.
     */
    public function fetch(string $domain): array
    {
        $domain = $this->normalizeDomain($domain);

        // Step 1: Try primary location /ia.json
        $primaryUrl = "https://{$domain}/ia.json";
        $data = $this->tryFetch($primaryUrl);

        if ($data !== null) {
            return $this->validate($data, $primaryUrl);
        }

        // Step 2: Try alternative location /.well-known/ia.json
        $wellKnownUrl = "https://{$domain}/.well-known/ia.json";
        $data = $this->tryFetch($wellKnownUrl);

        if ($data !== null) {
            return $this->validate($data, $wellKnownUrl);
        }

        // Step 3: Neither location has ia.json
        throw new IaJsonException(
            message: "No ia.json file found at {$domain}. "
                . "Tried {$primaryUrl} and {$wellKnownUrl}",
            errorCode: 'not_found',
        );
    }

    /**
     * Attempt to fetch and parse ia.json from a specific URL.
     *
     * @return array<string, mixed>|null Parsed data, or null if not found (404).
     *
     * @throws IaJsonException On non-404 HTTP errors or parse failures.
     */
    private function tryFetch(string $url): ?array
    {
        try {
            $response = $this->httpClient->request('GET', $url, [
                'headers' => [
                    'Accept' => 'application/json',
                    'User-Agent' => 'iajson-php/1.0.0',
                ],
                'http_errors' => false,
                'timeout' => 10,
                'connect_timeout' => 5,
            ]);

            $statusCode = $response->getStatusCode();

            // Not found - try the next location
            if ($statusCode === 404) {
                return null;
            }

            // Other HTTP errors
            if ($statusCode >= 400) {
                throw new IaJsonException(
                    message: "Failed to fetch ia.json from {$url}: HTTP {$statusCode}",
                    code: $statusCode,
                    errorCode: 'fetch_failed',
                );
            }

            $rawBody = (string) $response->getBody();

            // Check file size limit
            if (strlen($rawBody) > self::MAX_FILE_SIZE) {
                throw new IaJsonException(
                    message: "ia.json file at {$url} exceeds the 1 MB size limit",
                    errorCode: 'file_too_large',
                );
            }

            // Parse JSON
            $data = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);

            if (!is_array($data)) {
                throw new IaJsonException(
                    message: "ia.json at {$url} is not a valid JSON object",
                    errorCode: 'invalid_format',
                );
            }

            return $data;
        } catch (\JsonException $e) {
            throw new IaJsonException(
                message: "Failed to parse ia.json from {$url}: " . $e->getMessage(),
                previous: $e,
                errorCode: 'parse_error',
            );
        } catch (GuzzleException $e) {
            throw new IaJsonException(
                message: "HTTP error fetching ia.json from {$url}: " . $e->getMessage(),
                code: $e->getCode(),
                previous: $e,
                errorCode: 'network_error',
            );
        }
    }

    /**
     * Validate the basic structure of an ia.json file.
     *
     * @param array<string, mixed> $data The parsed ia.json data.
     * @param string               $url  The URL the data was fetched from (for error messages).
     *
     * @return array<string, mixed> The validated data.
     *
     * @throws IaJsonException If validation fails.
     */
    private function validate(array $data, string $url): array
    {
        // Check required top-level fields
        $requiredFields = ['version', 'site', 'api'];
        foreach ($requiredFields as $field) {
            if (!isset($data[$field])) {
                throw new IaJsonException(
                    message: "ia.json at {$url} is missing required field: {$field}",
                    errorCode: 'validation_error',
                );
            }
        }

        // Check version compatibility
        $version = $data['version'];
        $majorVersion = explode('.', $version)[0] ?? '';
        if ($majorVersion !== self::SUPPORTED_MAJOR_VERSION) {
            throw new IaJsonException(
                message: "Unsupported ia.json major version: {$version}. "
                    . 'This client supports version ' . self::SUPPORTED_MAJOR_VERSION . '.x.x',
                errorCode: 'unsupported_version',
            );
        }

        // Check site has required fields
        if (!isset($data['site']['name'], $data['site']['type'])) {
            throw new IaJsonException(
                message: "ia.json at {$url} has an invalid site section: "
                    . 'name and type are required',
                errorCode: 'validation_error',
            );
        }

        // Check api has base_url and at least one endpoint group
        if (!isset($data['api']['base_url'])) {
            throw new IaJsonException(
                message: "ia.json at {$url} has an invalid api section: "
                    . 'base_url is required',
                errorCode: 'validation_error',
            );
        }

        $hasEndpoints = isset($data['api']['public'])
            || isset($data['api']['protected'])
            || isset($data['api']['user_required']);

        if (!$hasEndpoints) {
            throw new IaJsonException(
                message: "ia.json at {$url} has no endpoint groups. "
                    . 'At least one of public, protected, or user_required is required.',
                errorCode: 'validation_error',
            );
        }

        return $data;
    }

    /**
     * Normalize a domain string by stripping protocol prefixes and trailing slashes.
     */
    private function normalizeDomain(string $domain): string
    {
        // Strip protocol if provided
        $domain = preg_replace('#^https?://#', '', $domain) ?? $domain;

        // Strip trailing slashes and paths
        $domain = explode('/', $domain)[0];

        // Strip trailing dot
        $domain = rtrim($domain, '.');

        if ($domain === '') {
            throw new IaJsonException(
                message: 'Domain must not be empty',
                errorCode: 'invalid_domain',
            );
        }

        return $domain;
    }
}

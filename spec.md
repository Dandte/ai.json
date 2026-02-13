# ia.json Specification v1.0.0

## Abstract

This document defines ia.json, a machine-readable file format that allows websites to declare how artificial intelligence agents can interact with them. By placing an `ia.json` file at a well-known location, website operators provide AI agents with structured information about available API endpoints, authentication requirements, security policies, and operational capabilities.

## Status of This Document

This is version 1.0.0 of the ia.json specification. It is an open standard maintained by the community under the MIT License.

## Table of Contents

1. [Introduction](#1-introduction)
2. [Terminology](#2-terminology)
3. [File Discovery](#3-file-discovery)
4. [Format Specification](#4-format-specification)
5. [Security Model](#5-security-model)
6. [Processing Model](#6-processing-model)
7. [Versioning](#7-versioning)
8. [Security Considerations](#8-security-considerations)
9. [Examples](#9-examples)
10. [Appendix A: JSON Schema](#appendix-a-json-schema)
11. [Appendix B: Test Vectors](#appendix-b-test-vectors)

---

## 1. Introduction

### 1.1 Purpose

AI agents increasingly need to interact with websites programmatically — searching products, placing orders, managing accounts, and consuming APIs. Currently, there is no standard way for a website to communicate its capabilities to AI agents. Each integration requires custom development, leading to fragile connections that break when websites change.

ia.json provides a standardized, machine-readable declaration that tells AI agents:
- What API endpoints are available
- What operations each endpoint supports
- How to authenticate (both the AI agent itself and end users)
- What security policies apply
- What rate limits are enforced

### 1.2 Scope

ia.json covers **API discovery and interaction**. It does not cover:
- Content indexing (covered by sitemaps, llms.txt)
- Crawler access control (covered by robots.txt)
- Browser automation or DOM interaction (covered by agent-permissions.json)
- Runtime tool execution protocol (covered by MCP)

### 1.3 Relationship to Other Standards

| Standard | Purpose | Relationship to ia.json |
|----------|---------|------------------------|
| robots.txt | Crawler access control | Complementary — ia.json handles API interaction |
| llms.txt | Content for LLM consumption | Complementary — ia.json handles actions, not content |
| OpenAPI | API documentation | ia.json is simpler, AI-focused, includes auth/security model |
| MCP | LLM-to-tool protocol | Complementary — ia.json declares what's available, MCP executes |

### 1.4 Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

- **Site**: A website or web service that publishes an ia.json file.
- **AI Agent**: A software system powered by artificial intelligence that consumes ia.json files to interact with sites.
- **Endpoint**: A specific API path that accepts HTTP requests.
- **Access Level**: The authentication requirement for an endpoint: public, protected, or user_required.

---

## 2. Terminology

### 2.1 Access Levels

ia.json defines three access levels for API endpoints:

| Level | Description | Authentication Required |
|-------|-------------|------------------------|
| `public` | No authentication needed. Anyone can access. | None |
| `protected` | Requires AI agent authentication (signed key). | AI agent key + signature |
| `user_required` | Requires both AI agent authentication and user authorization (OAuth2). | AI agent key + user OAuth token |

---

## 3. File Discovery

### 3.1 Primary Location

An ia.json file MUST be served at:

```
https://{domain}/ia.json
```

For example: `https://example.com/ia.json`

### 3.2 Alternative Location

Sites MAY also serve the file at the well-known URI:

```
https://{domain}/.well-known/ia.json
```

If both locations exist, the file at `/ia.json` takes precedence.

### 3.3 Content-Type

The file MUST be served with `Content-Type: application/json`.

### 3.4 HTTPS

The file MUST be served over HTTPS. AI agents SHOULD NOT fetch ia.json over plain HTTP.

### 3.5 Caching

Sites SHOULD include appropriate `Cache-Control` headers. A RECOMMENDED value is:

```
Cache-Control: public, max-age=3600
```

AI agents SHOULD respect cache headers and avoid fetching the file more often than necessary.

### 3.6 File Size

The ia.json file SHOULD NOT exceed 1 MB. AI agents MAY refuse to process files larger than this limit.

---

## 4. Format Specification

An ia.json file is a JSON object with the following top-level properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `version` | string | Yes | Specification version (semver) |
| `site` | object | Yes | Site metadata |
| `api` | object | Yes | API endpoint declarations |
| `auth` | object | No | Authentication configuration |
| `security` | object | No | Security policies |
| `capabilities` | object | No | Feature flags |
| `webhooks` | object | No | Webhook event declarations |
| `metadata` | object | No | File metadata |

### 4.1 `version` (Required)

The version of the ia.json specification that the file conforms to.

- Type: `string`
- Format: Semantic versioning (`MAJOR.MINOR.PATCH`)
- Current version: `"1.0.0"`

```json
{
  "version": "1.0.0"
}
```

### 4.2 `site` (Required)

Metadata about the site.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Human-readable site name |
| `description` | string | No | Short description of the site |
| `type` | string | Yes | Site type (see below) |
| `url` | string | No | Site URL |
| `logo` | string | No | URL to site logo |
| `currency` | string | No | ISO 4217 currency code |
| `language` | string | No | BCP 47 language tag |
| `timezone` | string | No | IANA timezone identifier |
| `contact` | string | No | Contact email |

#### Site Types

The `type` field MUST be one of:

| Value | Description |
|-------|-------------|
| `ecommerce` | Online store |
| `saas` | Software as a Service |
| `blog` | Blog or content site |
| `api` | Public API service |
| `marketplace` | Multi-vendor marketplace |
| `social` | Social media platform |
| `finance` | Financial services |
| `education` | Educational platform |
| `healthcare` | Healthcare services |
| `government` | Government services |
| `other` | Other type of site |

```json
{
  "site": {
    "name": "My Store",
    "description": "Online electronics store",
    "type": "ecommerce",
    "url": "https://mystore.com",
    "currency": "USD",
    "language": "en",
    "contact": "api@mystore.com"
  }
}
```

### 4.3 `api` (Required)

Declares available API endpoints organized by access level.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `base_url` | string | Yes | Base URL for all API endpoints |
| `public` | object | No | Endpoints requiring no authentication |
| `protected` | object | No | Endpoints requiring AI agent authentication |
| `user_required` | object | No | Endpoints requiring user authorization |

At least one of `public`, `protected`, or `user_required` MUST be present.

#### 4.3.1 `base_url`

The base URL that is prepended to all endpoint paths. MUST be an absolute HTTPS URL.

```json
{
  "api": {
    "base_url": "https://mystore.com/api/v1"
  }
}
```

#### 4.3.2 Endpoint Groups

Each access level (`public`, `protected`, `user_required`) is an object where keys are endpoint names and values are endpoint objects.

Endpoint names MUST:
- Use `snake_case`
- Be descriptive (e.g., `search_products`, not `sp`)
- Be unique within the entire `api` section

#### 4.3.3 Endpoint Object

Each endpoint object has the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `method` | string | Yes | HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) |
| `path` | string | Yes | URL path (appended to `base_url`) |
| `description` | string | Yes | Human-readable description |
| `parameters` | object | No | Request parameters |
| `body` | object | No | Request body schema (for POST/PUT/PATCH) |
| `response` | object | No | Response schema description |
| `rate_limit` | string | No | Endpoint-specific rate limit |
| `scopes` | array | No | Required OAuth2 scopes (for `user_required` endpoints) |
| `deprecated` | boolean | No | Whether the endpoint is deprecated |

```json
{
  "search_products": {
    "method": "GET",
    "path": "/products/search",
    "description": "Search products by keyword",
    "parameters": {
      "q": {
        "type": "string",
        "required": true,
        "description": "Search query"
      },
      "page": {
        "type": "integer",
        "required": false,
        "description": "Page number",
        "default": 1
      },
      "per_page": {
        "type": "integer",
        "required": false,
        "description": "Items per page",
        "default": 20
      }
    }
  }
}
```

#### 4.3.4 Parameter Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | Yes | Data type: `string`, `integer`, `number`, `boolean`, `array`, `object` |
| `required` | boolean | Yes | Whether the parameter is required |
| `description` | string | No | Human-readable description |
| `default` | any | No | Default value |
| `example` | any | No | Example value |
| `enum` | array | No | Allowed values |
| `min` | number | No | Minimum value (for numbers) |
| `max` | number | No | Maximum value (for numbers) |
| `pattern` | string | No | Regex pattern (for strings) |

#### 4.3.5 Body Object

For endpoints that accept a request body (POST, PUT, PATCH), the `body` property describes the expected fields using the same format as parameters:

```json
{
  "create_order": {
    "method": "POST",
    "path": "/orders",
    "description": "Create a new order",
    "body": {
      "product_id": {
        "type": "string",
        "required": true,
        "description": "Product ID"
      },
      "quantity": {
        "type": "integer",
        "required": true,
        "description": "Quantity to order",
        "min": 1
      },
      "shipping_address": {
        "type": "object",
        "required": true,
        "description": "Shipping address"
      }
    },
    "scopes": ["orders:write"]
  }
}
```

#### 4.3.6 Path Parameters

Path parameters are indicated with curly braces in the path:

```json
{
  "get_product": {
    "method": "GET",
    "path": "/products/{id}",
    "description": "Get product by ID",
    "parameters": {
      "id": {
        "type": "string",
        "required": true,
        "description": "Product ID"
      }
    }
  }
}
```

### 4.4 `auth` (Optional)

Declares authentication methods. If any `protected` or `user_required` endpoints exist, `auth` SHOULD be present.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `signed_key` | object | No | AI agent key-based authentication |
| `oauth2` | object | No | OAuth2 for user authorization |
| `api_key` | object | No | Simple API key authentication |
| `bearer` | object | No | Bearer token authentication |

A site MAY support multiple authentication methods simultaneously.

#### 4.4.1 `signed_key` Authentication

Used for AI agent authentication. The AI agent registers with the site and receives a key pair (api_key + secret). Each request is signed using HMAC.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `register_url` | string | Yes | URL for AI agent registration |
| `algorithm` | string | Yes | Signing algorithm: `sha256` or `sha512` |
| `header_prefix` | string | No | Prefix for auth headers (default: `X-IA-`) |
| `key_rotation_days` | integer | No | Days before key rotation is required |

Headers sent with each request:
- `{prefix}Key`: The API key
- `{prefix}Signature`: The HMAC signature
- `{prefix}Timestamp`: Unix timestamp of the request

```json
{
  "auth": {
    "signed_key": {
      "register_url": "https://mystore.com/ia/register",
      "algorithm": "sha256",
      "header_prefix": "X-IA-",
      "key_rotation_days": 90
    }
  }
}
```

#### 4.4.2 `oauth2` Authentication

Used when endpoints require user authorization. Follows RFC 6749.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `authorization_url` | string | Yes | OAuth2 authorization endpoint |
| `token_url` | string | Yes | OAuth2 token endpoint |
| `scopes` | object | Yes | Available scopes (key: scope name, value: description) |
| `grant_types` | array | No | Supported grant types (default: `["authorization_code"]`) |
| `pkce_required` | boolean | No | Whether PKCE is required (RECOMMENDED: `true`) |

```json
{
  "auth": {
    "oauth2": {
      "authorization_url": "https://mystore.com/oauth/authorize",
      "token_url": "https://mystore.com/oauth/token",
      "scopes": {
        "read": "Read access to public data",
        "orders:read": "Read user orders",
        "orders:write": "Create orders on behalf of users"
      },
      "grant_types": ["authorization_code"],
      "pkce_required": true
    }
  }
}
```

#### 4.4.3 `api_key` Authentication

Simple API key authentication via header.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `header` | string | Yes | Header name for the API key |
| `request_url` | string | No | URL to request an API key |

```json
{
  "auth": {
    "api_key": {
      "header": "X-API-Key",
      "request_url": "https://mystore.com/developers/keys"
    }
  }
}
```

#### 4.4.4 `bearer` Authentication

Bearer token authentication via the Authorization header.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `token_url` | string | Yes | URL to obtain a token |
| `expires_in` | integer | No | Token lifetime in seconds |

```json
{
  "auth": {
    "bearer": {
      "token_url": "https://mystore.com/auth/token",
      "expires_in": 3600
    }
  }
}
```

### 4.5 `security` (Optional)

Security policies for AI agent interactions.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `https_required` | boolean | No | Whether HTTPS is required (default: `true`) |
| `rate_limit` | string | No | Global rate limit (e.g., `"1000/hour"`) |
| `verify_signature` | boolean | No | Whether request signatures are verified |
| `max_request_size` | string | No | Maximum request body size (e.g., `"1mb"`) |
| `allowed_origins` | array | No | Allowed origins for CORS |
| `ip_whitelist` | array | No | Allowed IP addresses |
| `auto_block` | object | No | Automatic blocking configuration |

#### 4.5.1 Rate Limit Format

Rate limits are expressed as `"{count}/{period}"` where period is one of: `second`, `minute`, `hour`, `day`.

Examples: `"60/minute"`, `"1000/hour"`, `"10000/day"`

#### 4.5.2 Auto Block

Automatic blocking of misbehaving agents.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `failed_attempts` | integer | Yes | Number of failed attempts before blocking |
| `window_minutes` | integer | Yes | Time window for counting failures |
| `block_duration_minutes` | integer | Yes | How long to block (in minutes) |

```json
{
  "security": {
    "https_required": true,
    "rate_limit": "1000/hour",
    "verify_signature": true,
    "auto_block": {
      "failed_attempts": 10,
      "window_minutes": 5,
      "block_duration_minutes": 60
    }
  }
}
```

### 4.6 `capabilities` (Optional)

Feature flags indicating what the site supports. Each capability is a boolean.

Standard capabilities:

| Capability | Description |
|-----------|-------------|
| `read` | Read/query data |
| `write` | Create or modify data |
| `delete` | Delete data |
| `search` | Full-text search |
| `checkout` | E-commerce checkout |
| `user_management` | User account operations |
| `webhooks` | Real-time event notifications |
| `bulk_operations` | Batch/bulk API calls |
| `real_time` | WebSocket or SSE support |

Sites MAY define custom capabilities using the `x_` prefix:

```json
{
  "capabilities": {
    "read": true,
    "write": true,
    "search": true,
    "checkout": true,
    "webhooks": true,
    "x_gift_wrapping": true
  }
}
```

### 4.7 `webhooks` (Optional)

Declares webhook events that the site can send to registered AI agents.

Each key is an event name, and the value is an object describing the event:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `description` | string | Yes | Human-readable description |
| `payload` | object | No | Description of the webhook payload fields |

```json
{
  "webhooks": {
    "order_created": {
      "description": "Triggered when a new order is created",
      "payload": {
        "order_id": { "type": "string" },
        "total": { "type": "number" },
        "currency": { "type": "string" }
      }
    },
    "order_shipped": {
      "description": "Triggered when an order is shipped",
      "payload": {
        "order_id": { "type": "string" },
        "tracking_number": { "type": "string" }
      }
    }
  }
}
```

### 4.8 `metadata` (Optional)

File metadata.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `created` | string | No | ISO 8601 creation date |
| `updated` | string | No | ISO 8601 last update date |
| `spec_version` | string | No | Version of the spec used to create this file |
| `generator` | string | No | Tool or method used to generate the file |
| `docs_url` | string | No | URL to the site's API documentation |
| `support_url` | string | No | URL for developer support |

```json
{
  "metadata": {
    "created": "2026-01-15T00:00:00Z",
    "updated": "2026-02-10T12:00:00Z",
    "spec_version": "1.0.0",
    "generator": "manual",
    "docs_url": "https://mystore.com/docs",
    "support_url": "https://mystore.com/support"
  }
}
```

---

## 5. Security Model

### 5.1 Registration Flow

When a site requires AI agent authentication (`signed_key`), the following registration flow is used:

```
AI Agent                              Site
   |                                    |
   |  1. POST /ia/register              |
   |  {name, domain, webhook, contact}  |
   |  --------------------------------> |
   |                                    |
   |  2. POST {webhook}                 |
   |  {verification_code}               |
   |  <-------------------------------- |
   |                                    |
   |  3. POST /ia/verify                |
   |  {verification_code}               |
   |  --------------------------------> |
   |                                    |
   |  4. Response                       |
   |  {api_key, secret}                 |
   |  <-------------------------------- |
   |                                    |
```

#### Step 1: Registration Request

The AI agent sends a POST request to the `register_url`:

```json
POST /ia/register
Content-Type: application/json

{
  "name": "My AI Assistant",
  "domain": "myai.example.com",
  "webhook_url": "https://myai.example.com/verify",
  "contact": "admin@myai.example.com",
  "description": "AI shopping assistant"
}
```

#### Step 2: Domain Verification

The site sends a verification code to the webhook URL to confirm domain ownership:

```json
POST https://myai.example.com/verify
Content-Type: application/json

{
  "verification_code": "vc_abc123def456",
  "site": "mystore.com",
  "expires_at": "2026-02-12T12:00:00Z"
}
```

#### Step 3: Verification Confirmation

The AI agent sends the verification code back to confirm:

```json
POST /ia/verify
Content-Type: application/json

{
  "verification_code": "vc_abc123def456"
}
```

#### Step 4: Credentials Issued

On successful verification, the site responds with credentials:

```json
{
  "api_key": "ia_live_abc123def456",
  "secret": "sec_xyz789uvw012",
  "expires_at": "2026-05-12T00:00:00Z",
  "permissions": ["public", "protected"]
}
```

### 5.2 Request Signing Algorithm

For each API request, the AI agent MUST generate a signature:

1. Get the current Unix timestamp in seconds
2. Create the signing string: `{timestamp}.{request_body}`
   - For GET requests with no body, use: `{timestamp}.`
3. Compute the HMAC using the configured algorithm:
   - `signature = HMAC-{algorithm}(secret, signing_string)`
4. Send the following headers:
   - `{prefix}Key: {api_key}`
   - `{prefix}Signature: {signature}`
   - `{prefix}Timestamp: {timestamp}`

#### Example (sha256)

```
Secret: sec_xyz789uvw012
Timestamp: 1707753600
Body: {"product_id":"prod_123","quantity":2}
Signing string: 1707753600.{"product_id":"prod_123","quantity":2}
Signature: HMAC-SHA256(sec_xyz789uvw012, signing_string) = a1b2c3d4...
```

### 5.3 Signature Verification

The site MUST verify each request:

1. **Check key exists**: The `api_key` must be a valid, active key
2. **Check timestamp**: The timestamp must be within `max_age_seconds` of the current time (default: 60 seconds)
3. **Check signature**: Recompute the signature and compare
4. **Check rate limit**: The request must not exceed the rate limit

If any check fails, the site MUST respond with the appropriate HTTP error:

| Condition | HTTP Status | Error Code |
|-----------|-------------|------------|
| Invalid key | 401 | `invalid_key` |
| Expired timestamp | 401 | `expired_timestamp` |
| Invalid signature | 401 | `invalid_signature` |
| Rate limit exceeded | 429 | `rate_limit_exceeded` |
| Blocked agent | 403 | `agent_blocked` |

### 5.4 Error Response Format

All error responses SHOULD follow this format:

```json
{
  "error": {
    "code": "invalid_signature",
    "message": "The request signature is invalid",
    "details": {}
  }
}
```

---

## 6. Processing Model

### 6.1 How AI Agents SHOULD Discover ia.json

1. Attempt to fetch `https://{domain}/ia.json`
2. If not found (404), attempt `https://{domain}/.well-known/ia.json`
3. If not found, the site does not support ia.json
4. Validate the file against the JSON Schema
5. Cache the result respecting HTTP cache headers

### 6.2 How AI Agents SHOULD Process ia.json

1. Parse the JSON file
2. Check the `version` field for compatibility
3. Read `site` metadata to understand the site
4. Enumerate available endpoints from `api`
5. If authentication is needed, follow the `auth` configuration
6. Respect `security` policies (rate limits, HTTPS)
7. Use `capabilities` to determine available features

### 6.3 How Websites SHOULD Serve ia.json

1. Serve the file at `/ia.json` with `Content-Type: application/json`
2. Use HTTPS
3. Include `Cache-Control` headers
4. Keep the file updated when APIs change
5. Implement the security policies declared in the file
6. Validate the file against the JSON Schema before publishing

---

## 7. Versioning

### 7.1 Specification Versioning

The specification follows semantic versioning:

- **MAJOR**: Breaking changes to the format
- **MINOR**: New optional fields or features
- **PATCH**: Clarifications, typo fixes, no format changes

### 7.2 Backward Compatibility

- AI agents SHOULD be able to process files with a higher MINOR or PATCH version
- AI agents MUST check the MAJOR version and reject files with an unsupported major version
- Sites SHOULD only use features from the declared version

---

## 8. Security Considerations

### 8.1 HTTPS

All ia.json files and API endpoints MUST be served over HTTPS. AI agents MUST NOT send credentials over unencrypted connections.

### 8.2 Replay Attacks

The timestamp-based signature mechanism prevents replay attacks. Sites SHOULD reject requests with timestamps older than 60 seconds.

### 8.3 Key Security

- API keys and secrets MUST be stored securely
- Secrets MUST NOT be transmitted after initial issuance
- Sites SHOULD support key rotation
- Compromised keys SHOULD be revokable immediately

### 8.4 Input Validation

- Sites MUST validate all input from AI agents
- Sites SHOULD sanitize query parameters
- Sites SHOULD enforce `max_request_size`

### 8.5 Rate Limiting

- Sites SHOULD implement rate limiting as declared in the ia.json
- AI agents MUST respect `429 Too Many Requests` responses
- AI agents SHOULD implement exponential backoff

### 8.6 Information Disclosure

- The ia.json file is public. Sites SHOULD NOT include sensitive information
- Internal-only endpoints SHOULD NOT be listed
- Sites SHOULD only expose endpoints intended for AI interaction

---

## 9. Examples

See the [examples/](examples/) directory for complete ia.json files:

- [Minimal](examples/minimal.json) - Bare minimum valid ia.json
- [E-commerce](examples/ecommerce.json) - Full online store
- [OAuth](examples/oauth.json) - OAuth2 authentication
- [Read-only](examples/readonly.json) - Public read-only API
- [Blog](examples/blog.json) - Content blog
- [SaaS](examples/saas.json) - Software as a Service

---

## Appendix A: JSON Schema

The official JSON Schema for validating ia.json files is available at:

- Repository: [schema/ia.schema.json](schema/ia.schema.json)
- URL: `https://iajson.org/schema/ia.schema.json`

---

## Appendix B: Test Vectors

### Signing Test Vector

```
Algorithm: sha256
Secret: "test_secret_key_123"
Timestamp: 1707753600
Body: '{"product_id":"prod_001","quantity":1}'
Signing string: '1707753600.{"product_id":"prod_001","quantity":1}'
Expected signature: compute HMAC-SHA256 of the signing string with the secret
```

### Empty Body Test Vector (GET request)

```
Algorithm: sha256
Secret: "test_secret_key_123"
Timestamp: 1707753600
Body: (empty)
Signing string: '1707753600.'
Expected signature: compute HMAC-SHA256 of the signing string with the secret
```

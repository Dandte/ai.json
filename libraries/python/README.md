# iajson

Python reference library for consuming [ia.json](https://iajson.org) files -- the universal standard for AI interaction with websites.

## Installation

```bash
pip install iajson
```

Requires Python 3.10+. The only runtime dependency is [httpx](https://www.python-httpx.org/).

## Quick start

### Synchronous

```python
from iajson import IaJsonClient

# Discover and connect to a site
client = IaJsonClient.discover("techstore.example.com")

# Inspect the site
print(client.site.name)        # "TechStore"
print(client.site.type)        # "ecommerce"
print(client.version)          # "1.0.0"
print(client.capabilities)     # {"read": True, "write": True, ...}

# List available endpoints
for ep in client.get_endpoints():
    print(f"{ep.name} [{ep.method} {ep.path}] ({ep.level})")

# Filter by access level
public_endpoints = client.get_endpoints(level="public")

# Call a public endpoint
products = client.call("search_products", q="wireless headphones")
print(products)
```

### Asynchronous

```python
import asyncio
from iajson import IaJsonClient

async def main():
    client = await IaJsonClient.adiscover("techstore.example.com")

    products = await client.acall("search_products", q="wireless headphones")
    print(products)

    product = await client.acall("get_product", id="prod_abc123")
    print(product)

asyncio.run(main())
```

## Authentication

### Signed-key authentication (protected endpoints)

If you already have credentials:

```python
client = IaJsonClient.discover(
    "techstore.example.com",
    api_key="ia_live_abc123def456",
    secret="sec_xyz789uvw012",
)

# Call a protected endpoint -- signing is automatic
inventory = client.call("get_inventory")
```

Or set credentials after discovery:

```python
client = IaJsonClient.discover("techstore.example.com")
client.set_credentials(api_key="ia_live_abc123def456", secret="sec_xyz789uvw012")
inventory = client.call("get_inventory")
```

### Agent registration

The full registration flow (Section 5.1 of the ia.json spec):

```python
from iajson import IaJsonClient, AgentInfo

client = IaJsonClient.discover("techstore.example.com")

# Step 1: Send registration request
agent = AgentInfo(
    name="My AI Assistant",
    domain="myai.example.com",
    webhook_url="https://myai.example.com/verify",
    contact="admin@myai.example.com",
    description="AI shopping assistant",
)
client.register(agent)

# Step 2: The site sends a verification code to your webhook_url.
#          Handle that in your webhook handler.

# Step 3 & 4: Submit the verification code and receive credentials
verification_code = "vc_abc123def456"  # received at your webhook
creds = client.complete_registration(verification_code)

print(creds.api_key)       # "ia_live_..."
print(creds.secret)         # "sec_..."
print(creds.expires_at)     # "2026-05-12T00:00:00Z"
print(creds.permissions)    # ["public", "protected"]

# Credentials are now stored on the client automatically
inventory = client.call("get_inventory")
```

### OAuth2 (user_required endpoints)

```python
from iajson import IaJsonClient
from iajson.auth.oauth import OAuth2Config, generate_pkce_challenge, build_authorization_url, exchange_code

client = IaJsonClient.discover("techstore.example.com")

# Parse OAuth2 config from the ia.json document
oauth_config = OAuth2Config.from_dict(client.document["auth"]["oauth2"])

# Generate PKCE challenge
pkce = generate_pkce_challenge()

# Build the authorization URL for the user to visit
auth_url = build_authorization_url(
    oauth_config,
    client_id="your_client_id",
    redirect_uri="https://myai.example.com/callback",
    scopes=["cart:read", "cart:write", "orders:write"],
    state="random_csrf_token",
    pkce=pkce,
)
print(f"Send user to: {auth_url}")

# After the user authorizes, exchange the code for a token
token = exchange_code(
    oauth_config,
    client_id="your_client_id",
    client_secret="your_client_secret",
    code="authorization_code_from_callback",
    redirect_uri="https://myai.example.com/callback",
    code_verifier=pkce.verifier,
)

# Set the token on the client
client.set_access_token(token.access_token)

# Now call user_required endpoints
cart = client.call("get_cart")
client.call("add_to_cart", product_id="prod_abc123", quantity=2)
```

## Request signing

If you need to compute signatures manually:

```python
from iajson import sign, create_signed_headers

# Low-level: compute a signature
signature = sign(
    secret="sec_xyz789uvw012",
    timestamp=1707753600,
    body='{"product_id":"prod_123","quantity":2}',
)

# High-level: get a full set of auth headers
headers = create_signed_headers(
    api_key="ia_live_abc123def456",
    secret="sec_xyz789uvw012",
    body='{"product_id":"prod_123","quantity":2}',
    prefix="X-IA-",
    algorithm="sha256",
)
# headers = {
#     "X-IA-Key": "ia_live_abc123def456",
#     "X-IA-Signature": "a1b2c3d4...",
#     "X-IA-Timestamp": "1707753600",
# }
```

## Discovery

Low-level discovery (without creating a client):

```python
from iajson import discover, adiscover

# Synchronous
doc = discover("techstore.example.com")
print(doc["site"]["name"])

# Asynchronous
doc = await adiscover("techstore.example.com")
print(doc["api"]["base_url"])
```

## Endpoint introspection

```python
client = IaJsonClient.discover("techstore.example.com")

# Get a specific endpoint
ep = client.get_endpoint("search_products")
print(ep.name)          # "search_products"
print(ep.method)        # "GET"
print(ep.path)          # "/products/search"
print(ep.level)         # "public"
print(ep.description)   # "Search products by keyword"

# Inspect parameters
for param in ep.parameters:
    print(f"  {param.name}: {param.type} (required={param.required})")
    # q: string (required=True)
    # min_price: number (required=False)
    # max_price: number (required=False)

# Inspect body fields (for POST endpoints)
ep_order = client.get_endpoint("create_order")
for field in ep_order.body_fields:
    print(f"  {field.name}: {field.type} (required={field.required})")
```

## Error handling

```python
from iajson import (
    IaJsonClient,
    IaJsonError,
    AuthenticationError,
    DiscoveryError,
    RateLimitError,
)

try:
    client = IaJsonClient.discover("unknown-site.example.com")
except DiscoveryError as e:
    print(f"Discovery failed: {e.message}")
    print(f"Domain: {e.domain}")
    print(f"HTTP status: {e.status_code}")

try:
    result = client.call("get_inventory")
except AuthenticationError as e:
    print(f"Auth failed: {e.message}")
    print(f"Error code: {e.error_code}")  # e.g. "invalid_signature"
except RateLimitError as e:
    print(f"Rate limited! Retry after {e.retry_after} seconds")
except IaJsonError as e:
    print(f"General error: {e.message}")
```

## API reference

### `IaJsonClient`

| Method | Description |
|--------|-------------|
| `IaJsonClient.discover(domain)` | Fetch ia.json and create a client (sync) |
| `IaJsonClient.adiscover(domain)` | Fetch ia.json and create a client (async) |
| `client.call(endpoint, **params)` | Invoke an endpoint (sync) |
| `client.acall(endpoint, **params)` | Invoke an endpoint (async) |
| `client.get_endpoints(level=None)` | List endpoints, optionally filtered |
| `client.get_endpoint(name)` | Get a single endpoint by name |
| `client.register(agent_info)` | Start agent registration |
| `client.complete_registration(code)` | Finish registration with verification code |
| `client.sign(body)` | Compute a request signature |
| `client.set_credentials(key, secret)` | Set signed_key credentials |
| `client.set_access_token(token)` | Set an OAuth2 access token |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `client.site` | `SiteInfo` | Parsed site metadata |
| `client.base_url` | `str` | API base URL |
| `client.version` | `str` | ia.json spec version |
| `client.capabilities` | `dict` | Feature flags |
| `client.document` | `dict` | Raw ia.json document |

## License

MIT

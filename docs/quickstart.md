# Quick Start Guide

Create your first ia.json file in 5 minutes.

## Step 1: Create the File

Create a file named `ia.json` at the root of your domain. For example, if your site is `mystore.com`, the file should be accessible at `https://mystore.com/ia.json`.

## Step 2: Add the Minimum Required Fields

Every ia.json file needs three things: a version, site info, and at least one API endpoint.

```json
{
  "version": "1.0.0",
  "site": {
    "name": "My Store",
    "type": "ecommerce"
  },
  "api": {
    "base_url": "https://mystore.com/api",
    "public": {
      "search_products": {
        "method": "GET",
        "path": "/products/search",
        "description": "Search products by keyword",
        "parameters": {
          "q": {
            "type": "string",
            "required": true,
            "description": "Search query"
          }
        }
      }
    }
  }
}
```

That's it! AI agents can now discover your API and search your products.

## Step 3: Add More Endpoints (Optional)

Add more public endpoints to expose more functionality:

```json
{
  "version": "1.0.0",
  "site": {
    "name": "My Store",
    "type": "ecommerce",
    "currency": "USD",
    "language": "en"
  },
  "api": {
    "base_url": "https://mystore.com/api/v1",
    "public": {
      "search_products": {
        "method": "GET",
        "path": "/products/search",
        "description": "Search products by keyword",
        "parameters": {
          "q": {
            "type": "string",
            "required": true,
            "description": "Search query"
          }
        }
      },
      "get_product": {
        "method": "GET",
        "path": "/products/{id}",
        "description": "Get product details",
        "parameters": {
          "id": {
            "type": "string",
            "required": true,
            "description": "Product ID"
          }
        }
      },
      "list_categories": {
        "method": "GET",
        "path": "/categories",
        "description": "List all product categories"
      }
    }
  }
}
```

## Step 4: Add Authentication (Optional)

If you want AI agents to register before accessing certain endpoints:

```json
{
  "version": "1.0.0",
  "site": {
    "name": "My Store",
    "type": "ecommerce"
  },
  "api": {
    "base_url": "https://mystore.com/api/v1",
    "public": {
      "search_products": {
        "method": "GET",
        "path": "/products/search",
        "description": "Search products",
        "parameters": {
          "q": { "type": "string", "required": true, "description": "Query" }
        }
      }
    },
    "protected": {
      "get_inventory": {
        "method": "GET",
        "path": "/inventory",
        "description": "Get inventory levels (requires AI registration)"
      }
    }
  },
  "auth": {
    "signed_key": {
      "register_url": "https://mystore.com/ia/register",
      "algorithm": "sha256"
    }
  },
  "security": {
    "https_required": true,
    "rate_limit": "1000/hour",
    "verify_signature": true
  }
}
```

## Step 5: Validate Your File

Make sure your ia.json is valid:

```bash
npx ia-json-validator https://mystore.com/ia.json
```

## Step 6: Deploy

Place the file so it's served at `https://yourdomain.com/ia.json`. Common methods:

- **Static hosting**: Drop the file in your public directory
- **Web server**: Configure a route that serves the JSON file
- **CDN**: Upload and configure the endpoint

Make sure to:
- Serve with `Content-Type: application/json`
- Serve over HTTPS
- Set `Cache-Control: public, max-age=3600`

## What Happens Next?

Once your ia.json is live:

1. AI agents will discover it when users ask about your site
2. They'll read the available endpoints
3. For public endpoints, they can start making requests immediately
4. For protected endpoints, they'll go through the registration flow
5. Users benefit from AI agents that can reliably interact with your site

## Next Steps

- See [Examples](../examples/) for more complex configurations
- Read [Security Best Practices](security-best-practices.md) to harden your setup
- Check [Platform Guides](platform-examples/) for framework-specific instructions

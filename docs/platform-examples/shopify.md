# ia.json for Shopify

How to add ia.json support to your Shopify store.

## Approach

Shopify doesn't allow serving arbitrary files from the root domain, so you have two options:

### Option 1: Shopify App Proxy

Create a Shopify app that serves the ia.json file via an app proxy.

1. In your Shopify app settings, configure an App Proxy:
   - **Subpath prefix**: `apps`
   - **Subpath**: `ia-json`
   - **Proxy URL**: `https://your-app-server.com/shopify/ia-json`

2. On your app server, serve the ia.json content:

```javascript
// Express.js app server
app.get('/shopify/ia-json', (req, res) => {
  const shop = req.query.shop;

  res.json({
    version: '1.0.0',
    site: {
      name: shop,
      type: 'ecommerce',
      url: `https://${shop}`,
      currency: 'USD', // Fetch from Shopify Admin API
      language: 'en',
    },
    api: {
      base_url: `https://${shop}/apps/ia-json/api`,
      public: {
        list_products: {
          method: 'GET',
          path: '/products',
          description: 'List all products',
          parameters: {
            page: { type: 'integer', required: false, description: 'Page number' },
            collection: { type: 'string', required: false, description: 'Collection handle' },
          },
        },
        get_product: {
          method: 'GET',
          path: '/products/{handle}',
          description: 'Get product by handle',
          parameters: {
            handle: { type: 'string', required: true, description: 'Product handle' },
          },
        },
        search_products: {
          method: 'GET',
          path: '/search',
          description: 'Search products',
          parameters: {
            q: { type: 'string', required: true, description: 'Search query' },
          },
        },
        list_collections: {
          method: 'GET',
          path: '/collections',
          description: 'List all collections',
        },
      },
    },
    capabilities: {
      read: true,
      search: true,
    },
    metadata: {
      spec_version: '1.0.0',
      generator: 'shopify-app',
    },
  });
});
```

### Option 2: Storefront API + Static JSON

Use Shopify's Storefront API and host the ia.json as a page in your theme.

1. Create a page template `page.ia-json.liquid`:

```liquid
{% layout none %}
{% comment %}
  Serves ia.json for AI agent discovery
{% endcomment %}
{%- capture json_content -%}
{
  "version": "1.0.0",
  "site": {
    "name": "{{ shop.name | json }}",
    "type": "ecommerce",
    "url": "{{ shop.url }}",
    "currency": "{{ shop.currency }}",
    "language": "{{ request.locale.iso_code | slice: 0, 2 }}"
  },
  "api": {
    "base_url": "{{ shop.url }}/api/2024-01/graphql.json",
    "public": {
      "search_products": {
        "method": "POST",
        "path": "",
        "description": "Search products using Storefront API GraphQL"
      }
    }
  },
  "capabilities": {
    "read": true,
    "search": true
  },
  "metadata": {
    "spec_version": "1.0.0",
    "generator": "shopify-liquid"
  }
}
{%- endcapture -%}
{{ json_content }}
```

2. Create a page in Shopify admin with the URL handle `ia-json` using this template.

3. The file will be accessible at `https://yourstore.myshopify.com/pages/ia-json`.

## Notes

- Shopify's Storefront API requires a Storefront access token for most queries
- Consider using the REST Admin API endpoints if you need more control
- The App Proxy approach gives you the most flexibility

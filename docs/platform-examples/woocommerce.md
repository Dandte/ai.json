# ia.json for WooCommerce

How to add ia.json support to your WooCommerce store.

## Quick Setup

### Option 1: Static File

Create a file `ia.json` in your WordPress root directory (where `wp-config.php` is) and add your rewrite rules.

Add to your theme's `functions.php`:

```php
// Serve ia.json from WordPress root
add_action('init', function() {
    add_rewrite_rule('^ia\.json$', 'index.php?ia_json=1', 'top');
});

add_filter('query_vars', function($vars) {
    $vars[] = 'ia_json';
    return $vars;
});

add_action('template_redirect', function() {
    if (get_query_var('ia_json')) {
        header('Content-Type: application/json');
        header('Cache-Control: public, max-age=3600');

        echo json_encode([
            'version' => '1.0.0',
            'site' => [
                'name' => get_bloginfo('name'),
                'description' => get_bloginfo('description'),
                'type' => 'ecommerce',
                'url' => home_url(),
                'currency' => get_woocommerce_currency(),
                'language' => substr(get_locale(), 0, 2),
            ],
            'api' => [
                'base_url' => home_url('/wp-json/wc/v3'),
                'public' => [
                    'list_products' => [
                        'method' => 'GET',
                        'path' => '/products',
                        'description' => 'List all products',
                        'parameters' => [
                            'search' => ['type' => 'string', 'required' => false, 'description' => 'Search query'],
                            'category' => ['type' => 'string', 'required' => false, 'description' => 'Category ID'],
                            'per_page' => ['type' => 'integer', 'required' => false, 'description' => 'Items per page', 'default' => 10],
                            'page' => ['type' => 'integer', 'required' => false, 'description' => 'Page number', 'default' => 1],
                        ],
                    ],
                    'get_product' => [
                        'method' => 'GET',
                        'path' => '/products/{id}',
                        'description' => 'Get product details',
                        'parameters' => [
                            'id' => ['type' => 'integer', 'required' => true, 'description' => 'Product ID'],
                        ],
                    ],
                    'list_categories' => [
                        'method' => 'GET',
                        'path' => '/products/categories',
                        'description' => 'List product categories',
                    ],
                ],
            ],
            'capabilities' => [
                'read' => true,
                'search' => true,
            ],
            'metadata' => [
                'created' => date('c'),
                'updated' => date('c'),
                'spec_version' => '1.0.0',
                'generator' => 'woocommerce',
            ],
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }
});
```

After adding this code, go to **Settings > Permalinks** and click **Save** to flush rewrite rules.

### Option 2: WordPress Plugin

Create a plugin file `wp-content/plugins/ia-json/ia-json.php`:

```php
<?php
/**
 * Plugin Name: ia.json for WooCommerce
 * Description: Serves an ia.json file for AI agent interaction
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) exit;

class IaJsonPlugin {
    public function __construct() {
        add_action('init', [$this, 'addRewriteRule']);
        add_filter('query_vars', [$this, 'addQueryVar']);
        add_action('template_redirect', [$this, 'serveIaJson']);
    }

    public function addRewriteRule() {
        add_rewrite_rule('^ia\.json$', 'index.php?ia_json=1', 'top');
    }

    public function addQueryVar($vars) {
        $vars[] = 'ia_json';
        return $vars;
    }

    public function serveIaJson() {
        if (!get_query_var('ia_json')) return;

        header('Content-Type: application/json');
        header('Cache-Control: public, max-age=3600');
        header('Access-Control-Allow-Origin: *');

        echo json_encode($this->buildIaJson(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }

    private function buildIaJson(): array {
        $config = [
            'version' => '1.0.0',
            'site' => [
                'name' => get_bloginfo('name'),
                'type' => 'ecommerce',
                'url' => home_url(),
                'currency' => function_exists('get_woocommerce_currency')
                    ? get_woocommerce_currency() : 'USD',
                'language' => substr(get_locale(), 0, 2),
            ],
            'api' => [
                'base_url' => home_url('/wp-json/wc/v3'),
                'public' => $this->getPublicEndpoints(),
            ],
            'capabilities' => ['read' => true, 'search' => true],
            'metadata' => [
                'spec_version' => '1.0.0',
                'generator' => 'woocommerce-plugin',
            ],
        ];

        return $config;
    }

    private function getPublicEndpoints(): array {
        return [
            'list_products' => [
                'method' => 'GET',
                'path' => '/products',
                'description' => 'List all products with pagination and filtering',
                'parameters' => [
                    'search' => ['type' => 'string', 'required' => false, 'description' => 'Search query'],
                    'category' => ['type' => 'string', 'required' => false, 'description' => 'Category ID'],
                    'per_page' => ['type' => 'integer', 'required' => false, 'description' => 'Results per page'],
                    'page' => ['type' => 'integer', 'required' => false, 'description' => 'Page number'],
                    'orderby' => ['type' => 'string', 'required' => false, 'description' => 'Sort by field',
                        'enum' => ['date', 'price', 'title', 'popularity', 'rating']],
                ],
            ],
            'get_product' => [
                'method' => 'GET',
                'path' => '/products/{id}',
                'description' => 'Get a single product by ID',
                'parameters' => [
                    'id' => ['type' => 'integer', 'required' => true, 'description' => 'Product ID'],
                ],
            ],
            'list_categories' => [
                'method' => 'GET',
                'path' => '/products/categories',
                'description' => 'List all product categories',
            ],
            'search_products' => [
                'method' => 'GET',
                'path' => '/products',
                'description' => 'Search products by keyword',
                'parameters' => [
                    'search' => ['type' => 'string', 'required' => true, 'description' => 'Search keyword'],
                ],
            ],
        ];
    }
}

new IaJsonPlugin();

// Flush rewrite rules on activation
register_activation_hook(__FILE__, function() {
    (new IaJsonPlugin())->addRewriteRule();
    flush_rewrite_rules();
});
```

## Verification

After setup, visit `https://yourstore.com/ia.json` in your browser. You should see the JSON output. You can also validate it:

```bash
npx ia-json-validator https://yourstore.com/ia.json
```

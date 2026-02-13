// ia.json Website JavaScript

// Tab switching
function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  event.target.classList.add('active');
  document.getElementById('tab-' + tabId).classList.add('active');
}

// Copy code to clipboard
function copyCode(btn) {
  const pre = btn.parentElement.querySelector('pre');
  const text = pre.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 2000);
  });
}

// ia.json schema validation (client-side, simplified)
const REQUIRED_FIELDS = ['version', 'site', 'api'];
const SITE_TYPES = ['ecommerce', 'saas', 'blog', 'api', 'marketplace', 'social', 'finance', 'education', 'healthcare', 'government', 'other'];
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function validateIaJson(data) {
  const errors = [];
  const warnings = [];

  // Check type
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push({ path: '/', message: 'ia.json must be a JSON object' });
    return { valid: false, errors, warnings };
  }

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) {
      errors.push({ path: '/', message: `Missing required field: ${field}` });
    }
  }

  // Version
  if (data.version && !/^\d+\.\d+\.\d+$/.test(data.version)) {
    errors.push({ path: '/version', message: 'Version must be semver format (e.g., 1.0.0)' });
  }

  // Site
  if (data.site) {
    if (!data.site.name) {
      errors.push({ path: '/site', message: 'site.name is required' });
    }
    if (!data.site.type) {
      errors.push({ path: '/site', message: 'site.type is required' });
    } else if (!SITE_TYPES.includes(data.site.type)) {
      errors.push({ path: '/site/type', message: `Invalid site type: ${data.site.type}. Must be one of: ${SITE_TYPES.join(', ')}` });
    }
  }

  // API
  if (data.api) {
    if (!data.api.base_url) {
      errors.push({ path: '/api', message: 'api.base_url is required' });
    } else if (!data.api.base_url.startsWith('https://')) {
      warnings.push({ path: '/api/base_url', message: 'base_url should use HTTPS' });
    }

    const hasEndpoints = data.api.public || data.api.protected || data.api.user_required;
    if (!hasEndpoints) {
      errors.push({ path: '/api', message: 'At least one endpoint group (public, protected, or user_required) is required' });
    }

    // Validate endpoints
    for (const level of ['public', 'protected', 'user_required']) {
      const endpoints = data.api[level];
      if (!endpoints) continue;

      for (const [name, endpoint] of Object.entries(endpoints)) {
        if (!endpoint.method) {
          errors.push({ path: `/api/${level}/${name}`, message: 'method is required' });
        } else if (!HTTP_METHODS.includes(endpoint.method)) {
          errors.push({ path: `/api/${level}/${name}/method`, message: `Invalid HTTP method: ${endpoint.method}` });
        }
        if (!endpoint.path) {
          errors.push({ path: `/api/${level}/${name}`, message: 'path is required' });
        }
        if (!endpoint.description) {
          errors.push({ path: `/api/${level}/${name}`, message: 'description is required' });
        }
      }
    }
  }

  // Semantic checks
  if (data.api?.protected && !data.auth) {
    warnings.push({ path: '/auth', message: 'Protected endpoints defined but no auth section found' });
  }
  if (data.api?.user_required && (!data.auth || !data.auth.oauth2)) {
    warnings.push({ path: '/auth', message: 'User-required endpoints defined but no OAuth2 auth configured' });
  }

  // Check for unknown top-level properties
  const knownFields = ['version', 'site', 'api', 'auth', 'security', 'capabilities', 'webhooks', 'metadata'];
  for (const key of Object.keys(data)) {
    if (!knownFields.includes(key)) {
      warnings.push({ path: `/${key}`, message: `Unknown top-level property: ${key}` });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// Validate pasted JSON
function validateInput() {
  const textarea = document.getElementById('json-input');
  const resultDiv = document.getElementById('result');
  const input = textarea.value.trim();

  if (!input) {
    showResult(resultDiv, false, 'Please paste your ia.json content.');
    return;
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    showResult(resultDiv, false, `Invalid JSON: ${e.message}`);
    return;
  }

  const result = validateIaJson(data);
  displayResult(resultDiv, result);
}

// Validate from URL (via proxy or CORS)
async function validateUrl() {
  const urlInput = document.getElementById('url-input');
  const resultDiv = document.getElementById('result');
  const url = urlInput.value.trim();

  if (!url) {
    showResult(resultDiv, false, 'Please enter a URL.');
    return;
  }

  try {
    showResult(resultDiv, true, 'Fetching...');
    const response = await fetch(url);
    if (!response.ok) {
      showResult(resultDiv, false, `HTTP Error ${response.status}: ${response.statusText}`);
      return;
    }
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      showResult(resultDiv, false, `Response is not valid JSON: ${e.message}`);
      return;
    }

    // Also show it in the textarea
    document.getElementById('json-input').value = JSON.stringify(data, null, 2);

    const result = validateIaJson(data);
    displayResult(resultDiv, result);
  } catch (e) {
    showResult(resultDiv, false, `Could not fetch URL: ${e.message}\n\nNote: The URL must allow CORS requests, or use the CLI validator for non-CORS URLs.`);
  }
}

function displayResult(div, result) {
  let text = '';
  if (result.valid && result.warnings.length === 0) {
    text = '  Valid ia.json file!\n\nYour file conforms to the ia.json v1.0.0 specification.';
  } else if (result.valid) {
    text = '  Valid (with warnings)\n\n';
    text += result.warnings.map(w => `  ${w.path}: ${w.message}`).join('\n');
  } else {
    text = '  Invalid ia.json file\n\n';
    if (result.errors.length > 0) {
      text += `Errors (${result.errors.length}):\n`;
      text += result.errors.map(e => `  ${e.path}: ${e.message}`).join('\n');
    }
    if (result.warnings.length > 0) {
      text += `\n\nWarnings (${result.warnings.length}):\n`;
      text += result.warnings.map(w => `  ${w.path}: ${w.message}`).join('\n');
    }
  }
  showResult(div, result.valid, text);
}

function showResult(div, valid, text) {
  div.style.display = 'block';
  div.className = 'validator-result ' + (valid ? 'valid' : 'invalid');
  div.textContent = text;
}

// Load example files
const examples = {
  minimal: {
    version: "1.0.0",
    site: { name: "My Website", type: "other" },
    api: {
      base_url: "https://example.com/api",
      public: {
        get_info: { method: "GET", path: "/info", description: "Get basic site information" }
      }
    }
  },
  ecommerce: {
    version: "1.0.0",
    site: { name: "TechStore", description: "Online electronics store", type: "ecommerce", currency: "USD", language: "en" },
    api: {
      base_url: "https://techstore.example.com/api/v1",
      public: {
        search_products: {
          method: "GET", path: "/products/search", description: "Search products by keyword",
          parameters: { q: { type: "string", required: true, description: "Search query" } }
        },
        get_product: {
          method: "GET", path: "/products/{id}", description: "Get product details",
          parameters: { id: { type: "string", required: true, description: "Product ID" } }
        },
        list_categories: { method: "GET", path: "/categories", description: "List categories" }
      },
      protected: {
        get_inventory: { method: "GET", path: "/inventory", description: "Get inventory levels", rate_limit: "30/minute" }
      }
    },
    auth: {
      signed_key: { register_url: "https://techstore.example.com/ia/register", algorithm: "sha256" }
    },
    security: { https_required: true, rate_limit: "1000/hour", verify_signature: true },
    capabilities: { read: true, search: true, checkout: false }
  },
  blog: {
    version: "1.0.0",
    site: { name: "TechBlog", description: "Technology news and tutorials", type: "blog", language: "en" },
    api: {
      base_url: "https://techblog.example.com/api",
      public: {
        list_posts: {
          method: "GET", path: "/posts", description: "List published blog posts",
          parameters: {
            page: { type: "integer", required: false, description: "Page number", default: 1 },
            category: { type: "string", required: false, description: "Filter by category" }
          }
        },
        get_post: { method: "GET", path: "/posts/{slug}", description: "Get a blog post by slug",
          parameters: { slug: { type: "string", required: true, description: "Post URL slug" } }
        },
        search_posts: { method: "GET", path: "/posts/search", description: "Search posts",
          parameters: { q: { type: "string", required: true, description: "Search query" } }
        }
      }
    },
    capabilities: { read: true, search: true }
  },
  readonly: {
    version: "1.0.0",
    site: { name: "WeatherAPI", description: "Free weather data API", type: "api", language: "en" },
    api: {
      base_url: "https://api.weather.example.com/v1",
      public: {
        get_current: {
          method: "GET", path: "/weather/current", description: "Get current weather",
          parameters: {
            lat: { type: "number", required: true, description: "Latitude" },
            lon: { type: "number", required: true, description: "Longitude" }
          }
        },
        get_forecast: {
          method: "GET", path: "/weather/forecast", description: "Get 7-day forecast",
          parameters: {
            lat: { type: "number", required: true, description: "Latitude" },
            lon: { type: "number", required: true, description: "Longitude" },
            days: { type: "integer", required: false, description: "Forecast days", default: 7 }
          }
        }
      }
    },
    security: { https_required: true, rate_limit: "1000/day" },
    capabilities: { read: true, search: false }
  }
};

function loadExample(name) {
  const textarea = document.getElementById('json-input');
  textarea.value = JSON.stringify(examples[name], null, 2);
  validateInput();
}

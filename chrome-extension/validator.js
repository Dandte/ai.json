// ia.json Validation Logic (reused from website/js/main.js)

const REQUIRED_FIELDS = ['version', 'site', 'api'];
const SITE_TYPES = ['ecommerce', 'saas', 'blog', 'api', 'marketplace', 'social', 'finance', 'education', 'healthcare', 'government', 'other'];
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function validateIaJson(data) {
  const errors = [];
  const warnings = [];

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
    if (!data.site.name) errors.push({ path: '/site', message: 'site.name is required' });
    if (!data.site.type) {
      errors.push({ path: '/site', message: 'site.type is required' });
    } else if (!SITE_TYPES.includes(data.site.type)) {
      errors.push({ path: '/site/type', message: `Invalid site type: ${data.site.type}` });
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
      errors.push({ path: '/api', message: 'At least one endpoint group is required' });
    }

    for (const level of ['public', 'protected', 'user_required']) {
      const endpoints = data.api[level];
      if (!endpoints) continue;
      for (const [name, ep] of Object.entries(endpoints)) {
        if (!ep.method) errors.push({ path: `/api/${level}/${name}`, message: 'method is required' });
        else if (!HTTP_METHODS.includes(ep.method)) errors.push({ path: `/api/${level}/${name}/method`, message: `Invalid method: ${ep.method}` });
        if (!ep.path) errors.push({ path: `/api/${level}/${name}`, message: 'path is required' });
        if (!ep.description) errors.push({ path: `/api/${level}/${name}`, message: 'description is required' });
      }
    }
  }

  // Semantic checks
  if (data.api?.protected && !data.auth) {
    warnings.push({ path: '/auth', message: 'Protected endpoints but no auth section' });
  }
  if (data.api?.user_required && (!data.auth || !data.auth.oauth2)) {
    warnings.push({ path: '/auth', message: 'User-required endpoints but no OAuth2 configured' });
  }

  const knownFields = ['version', 'site', 'api', 'auth', 'security', 'capabilities', 'webhooks', 'metadata'];
  for (const key of Object.keys(data)) {
    if (!knownFields.includes(key)) {
      warnings.push({ path: `/${key}`, message: `Unknown property: ${key}` });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

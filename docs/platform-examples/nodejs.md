# ia.json for Node.js / Express

How to add ia.json support to your Node.js application.

## Quick Setup

### Step 1: Serve the ia.json Endpoint

```javascript
import express from 'express';

const app = express();
app.use(express.json());

// Serve ia.json
app.get('/ia.json', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    version: '1.0.0',
    site: {
      name: 'My API',
      description: 'My Node.js application',
      type: 'api',
      url: 'https://myapi.example.com',
      language: 'en',
    },
    api: {
      base_url: 'https://myapi.example.com/api/v1',
      public: {
        list_items: {
          method: 'GET',
          path: '/items',
          description: 'List all items',
          parameters: {
            page: { type: 'integer', required: false, description: 'Page number', default: 1 },
            limit: { type: 'integer', required: false, description: 'Items per page', default: 20 },
          },
        },
        get_item: {
          method: 'GET',
          path: '/items/{id}',
          description: 'Get item by ID',
          parameters: {
            id: { type: 'string', required: true, description: 'Item ID' },
          },
        },
        search: {
          method: 'GET',
          path: '/search',
          description: 'Search items',
          parameters: {
            q: { type: 'string', required: true, description: 'Search query' },
          },
        },
      },
    },
    capabilities: {
      read: true,
      search: true,
    },
    metadata: {
      spec_version: '1.0.0',
      generator: 'express',
    },
  });
});

// Your actual API endpoints
app.get('/api/v1/items', (req, res) => {
  // Your implementation
});

app.listen(3000);
```

### Step 2: Add Authentication Support

```javascript
import crypto from 'node:crypto';

// In-memory store (use a database in production)
const agents = new Map();
const pendingVerifications = new Map();

// Registration endpoint
app.post('/api/ia/register', async (req, res) => {
  const { name, domain, webhook_url, contact } = req.body;

  if (!name || !domain || !webhook_url || !contact) {
    return res.status(400).json({
      error: { code: 'invalid_request', message: 'Missing required fields' },
    });
  }

  // Generate verification code
  const code = 'vc_' + crypto.randomBytes(16).toString('hex');

  pendingVerifications.set(code, {
    name, domain, webhook_url, contact,
    expires: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  // Send verification to webhook
  try {
    await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verification_code: code,
        site: 'myapi.example.com',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      }),
    });
  } catch (err) {
    return res.status(400).json({
      error: { code: 'webhook_failed', message: 'Could not reach webhook URL' },
    });
  }

  res.json({ message: 'Verification sent to webhook' });
});

// Verification endpoint
app.post('/api/ia/verify', (req, res) => {
  const { verification_code } = req.body;
  const pending = pendingVerifications.get(verification_code);

  if (!pending || pending.expires < Date.now()) {
    pendingVerifications.delete(verification_code);
    return res.status(400).json({
      error: { code: 'invalid_code', message: 'Invalid or expired code' },
    });
  }

  pendingVerifications.delete(verification_code);

  // Generate credentials
  const apiKey = 'ia_' + crypto.randomBytes(16).toString('hex');
  const secret = 'sec_' + crypto.randomBytes(24).toString('hex');

  agents.set(apiKey, {
    ...pending,
    secret,
    created: new Date().toISOString(),
  });

  res.json({
    api_key: apiKey,
    secret,
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  });
});
```

### Step 3: Create Signature Verification Middleware

```javascript
function verifyIaSignature(req, res, next) {
  const prefix = 'x-ia-';
  const apiKey = req.headers[prefix + 'key'];
  const signature = req.headers[prefix + 'signature'];
  const timestamp = req.headers[prefix + 'timestamp'];

  if (!apiKey || !signature || !timestamp) {
    return res.status(401).json({
      error: { code: 'missing_auth', message: 'Missing authentication headers' },
    });
  }

  // Check timestamp (60 second window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 60) {
    return res.status(401).json({
      error: { code: 'expired_timestamp', message: 'Request timestamp expired' },
    });
  }

  // Look up agent
  const agent = agents.get(apiKey);
  if (!agent) {
    return res.status(401).json({
      error: { code: 'invalid_key', message: 'Invalid API key' },
    });
  }

  // Verify signature
  const body = req.body ? JSON.stringify(req.body) : '';
  const signingString = `${timestamp}.${body}`;
  const expected = crypto
    .createHmac('sha256', agent.secret)
    .update(signingString)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({
      error: { code: 'invalid_signature', message: 'Invalid request signature' },
    });
  }

  req.iaAgent = agent;
  next();
}

// Use the middleware on protected routes
app.get('/api/v1/inventory', verifyIaSignature, (req, res) => {
  res.json({ items: [/* ... */] });
});
```

### Step 4: Update ia.json with Auth

```javascript
app.get('/ia.json', (req, res) => {
  res.json({
    version: '1.0.0',
    site: {
      name: 'My API',
      type: 'api',
      url: 'https://myapi.example.com',
    },
    api: {
      base_url: 'https://myapi.example.com/api/v1',
      public: {
        search: {
          method: 'GET',
          path: '/search',
          description: 'Search items',
          parameters: {
            q: { type: 'string', required: true, description: 'Search query' },
          },
        },
      },
      protected: {
        get_inventory: {
          method: 'GET',
          path: '/inventory',
          description: 'Get inventory levels',
          rate_limit: '30/minute',
        },
      },
    },
    auth: {
      signed_key: {
        register_url: 'https://myapi.example.com/api/ia/register',
        algorithm: 'sha256',
        header_prefix: 'X-IA-',
        key_rotation_days: 90,
      },
    },
    security: {
      https_required: true,
      rate_limit: '1000/hour',
      verify_signature: true,
      auto_block: {
        failed_attempts: 10,
        window_minutes: 5,
        block_duration_minutes: 60,
      },
    },
  });
});
```

## Using with Fastify

```javascript
import Fastify from 'fastify';

const app = Fastify();

app.get('/ia.json', async (request, reply) => {
  reply.header('Cache-Control', 'public, max-age=3600');
  return {
    version: '1.0.0',
    site: { name: 'My Fastify App', type: 'api' },
    api: {
      base_url: 'https://myapi.example.com/api',
      public: {
        get_status: {
          method: 'GET',
          path: '/status',
          description: 'Health check',
        },
      },
    },
  };
});
```

## Validation

Test your ia.json:

```bash
npx ia-json-validator http://localhost:3000/ia.json
```

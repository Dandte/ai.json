# ia.json

**The universal standard for AI interaction with websites.**

ia.json is an open standard that allows any website to declare how AI agents can interact with it. Similar to how `robots.txt` tells search engine crawlers what they can access, `ia.json` tells AI agents what endpoints are available, how to authenticate, and what operations are permitted.

## Why ia.json?

AI agents currently have no reliable way to interact with websites programmatically. They have to guess where APIs are, what parameters they accept, and how to authenticate. This leads to:

- Broken integrations when websites change
- Security risks from uncontrolled access
- Poor user experiences from trial-and-error

**ia.json solves this.** A website owner places a single JSON file at their domain root (`example.com/ia.json`) that declares everything an AI needs to know.

## Quick Example

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
          "q": { "type": "string", "required": true, "description": "Search query" }
        }
      }
    }
  }
}
```

## Getting Started

### For Website Owners

1. Create an `ia.json` file at your domain root
2. Declare your endpoints and authentication
3. That's it - AI agents can now discover your API

See the [Quick Start Guide](docs/quickstart.md) for a 5-minute walkthrough.

### For AI Developers

1. Fetch `https://example.com/ia.json` to discover a site's capabilities
2. Register your AI agent (if the site requires authentication)
3. Make authenticated API calls

See [How AIs Consume ia.json](docs/how-ais-consume.md) for the full integration guide.

## Project Structure

| Directory | Description |
|-----------|-------------|
| [spec.md](spec.md) | Full technical specification |
| [schema/](schema/) | JSON Schema for validation |
| [examples/](examples/) | Example ia.json files |
| [validator/](validator/) | CLI and API validator |
| [libraries/](libraries/) | Reference libraries (Node.js, PHP, Python) |
| [docs/](docs/) | Documentation |
| [website/](website/) | Project website |

## Validate Your ia.json

### CLI
```bash
npx ia-json-validator https://yoursite.com/ia.json
```

### Programmatic (Node.js)
```typescript
import { IaJsonClient } from '@iajson/client';

const client = await IaJsonClient.discover('yoursite.com');
const products = await client.call('search_products', { q: 'laptop' });
```

## Specification

Read the full [ia.json Specification v1.0.0](spec.md).

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License. See [LICENSE](LICENSE).

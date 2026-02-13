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
| [chrome-extension/](chrome-extension/) | Chrome extension to view ia.json on any site |
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

## Chrome Extension

View the ia.json of any website directly from your browser.

1. Download the [chrome-extension/](chrome-extension/) folder
2. Go to `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and select the folder
4. Visit any website - the extension will detect its ia.json and show a green **IA** badge

The popup displays: site info, all endpoints grouped by access level, validation status, capabilities, and raw JSON.

## Generate ia.json with AI

Use our [AI Generator](https://dandte.github.io/ai.json/generator.html) to create your ia.json file. Copy the prompt, paste it into ChatGPT, Claude, or any AI, and answer a few questions about your website.

## Specification

Read the full [ia.json Specification v1.0.0](spec.md).

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License. See [LICENSE](LICENSE).

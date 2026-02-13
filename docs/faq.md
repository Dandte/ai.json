# Frequently Asked Questions

## General

### What is ia.json?

ia.json is an open standard that allows websites to declare how AI agents can interact with them. It's a JSON file placed at the root of a domain (e.g., `example.com/ia.json`) that describes available API endpoints, authentication methods, and security policies.

### How is it different from robots.txt?

robots.txt tells search engine crawlers which pages they can and cannot access. ia.json tells AI agents what API endpoints are available and how to use them. They serve different purposes and complement each other.

### How is it different from OpenAPI/Swagger?

OpenAPI is a comprehensive API documentation standard designed for human developers. ia.json is simpler, specifically designed for AI consumption, and includes built-in concepts for AI agent authentication and security. You can use both - OpenAPI for detailed API docs, ia.json for AI-specific interaction.

### How is it different from MCP (Model Context Protocol)?

MCP is a runtime protocol for LLM-to-tool communication. ia.json is a discovery standard that declares what's available. They complement each other: ia.json tells the AI what endpoints exist, MCP can be used to execute calls.

### Is ia.json free to use?

Yes. ia.json is open source under the MIT License. There are no fees, no registration, and no restrictions on use.

### Who maintains ia.json?

ia.json is a community-maintained open standard. Anyone can contribute on GitHub.

## For Website Owners

### Do I need to be technical to create an ia.json?

You need basic knowledge of JSON. If you can edit a configuration file, you can create an ia.json. See the [Quick Start Guide](quickstart.md) - it takes about 5 minutes.

### What if I only want AI agents to read data, not modify anything?

Only declare `public` endpoints with `GET` methods. Don't include `protected` or `user_required` sections:

```json
{
  "version": "1.0.0",
  "site": { "name": "My Blog", "type": "blog" },
  "api": {
    "base_url": "https://myblog.com/api",
    "public": {
      "list_posts": {
        "method": "GET",
        "path": "/posts",
        "description": "List all posts"
      }
    }
  },
  "capabilities": { "read": true }
}
```

### Can I block specific AI agents?

Yes. Use the `auto_block` security feature to automatically block agents that make too many failed requests. You can also manually block agents by revoking their API keys on your server side.

### What if an AI agent abuses my API?

1. The `auto_block` feature automatically handles common abuse patterns
2. You can revoke any AI agent's API key
3. Rate limits prevent excessive usage
4. You control what endpoints are exposed

### Do I need to create a separate API for AI agents?

No. You can use your existing API. ia.json just describes your existing endpoints in a standard format.

### Should I put my ia.json behind authentication?

No. The ia.json file itself should be publicly accessible. AI agents need to read it to discover your capabilities. The individual endpoints can require authentication.

## For AI Developers

### How do I find a site's ia.json?

Try fetching `https://domain.com/ia.json`. If that returns 404, try `https://domain.com/.well-known/ia.json`. If neither exists, the site doesn't support ia.json.

### What if the ia.json file is invalid?

Validate it with the validator tool. If it's invalid, treat the site as not supporting ia.json. Don't try to parse invalid files.

### Can I cache the ia.json file?

Yes, and you should. Respect the `Cache-Control` headers sent by the server. A typical cache duration is 1 hour.

### What if my registration is rejected?

Some sites may have approval processes for AI agents. Check if the site provides documentation about their approval process. You can also contact the site administrator using the `site.contact` email.

### Do I need to register with every site?

Only with sites that have `protected` or `user_required` endpoints. Public endpoints don't require registration.

## Security

### Is ia.json secure?

ia.json includes several security features:
- HMAC request signing (prevents tampering)
- Timestamp validation (prevents replay attacks)
- Rate limiting (prevents abuse)
- Auto-blocking (prevents brute force)
- OAuth2 with PKCE (secure user authorization)

### Can someone forge an ia.json file?

The ia.json file should only be trusted when fetched over HTTPS from the target domain. This ensures authenticity through TLS certificate verification.

### What if my API key is compromised?

1. Contact the site to revoke the key
2. Re-register to get new credentials
3. Update your stored credentials
4. Review logs for unauthorized access

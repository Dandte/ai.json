# ia.json Validator

CLI tool and API server for validating ia.json files against the official schema.

## Installation

```bash
npm install -g ia-json-validator
```

## CLI Usage

```bash
# Validate a local file
ia-json-validate ./ia.json

# Validate a remote file
ia-json-validate https://example.com/ia.json

# JSON output
ia-json-validate ./ia.json --format json

# Compact output
ia-json-validate ./ia.json --format compact

# Suppress warnings
ia-json-validate ./ia.json --quiet

# Read from stdin
cat ia.json | ia-json-validate -
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Valid |
| 1 | Invalid (validation errors) |
| 2 | Error (file not found, network error) |

## API Server

```bash
# Start the validation API
ia-json-validate serve --port 3000
```

### Endpoints

#### `POST /validate`

Validate an ia.json file.

**Request body (JSON content):**
```json
{
  "content": {
    "version": "1.0.0",
    "site": { "name": "Test", "type": "other" },
    "api": { "base_url": "https://example.com/api", "public": {} }
  }
}
```

**Request body (URL):**
```json
{
  "url": "https://example.com/ia.json"
}
```

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "schema_version": "1.0.0"
}
```

#### `GET /health`

Health check endpoint.

## Programmatic Usage

```typescript
import { validate, validateJson } from 'ia-json-validator';

const result = validate({
  version: "1.0.0",
  site: { name: "My Site", type: "other" },
  api: {
    base_url: "https://example.com/api",
    public: {
      get_info: { method: "GET", path: "/info", description: "Get info" }
    }
  }
});

console.log(result.valid);    // true
console.log(result.errors);   // []
console.log(result.warnings); // []
```

## Development

```bash
npm install
npm test
npm run build
```

## License

MIT

import { describe, it, expect } from "vitest";
import { validate, validateJson } from "../src/validator.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplesDir = resolve(__dirname, "../../examples");

function loadExample(name: string): unknown {
  const content = readFileSync(resolve(examplesDir, name), "utf-8");
  return JSON.parse(content);
}

describe("Schema Validation", () => {
  it("should validate minimal.json as valid", () => {
    const data = loadExample("minimal.json");
    const result = validate(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate ecommerce.json as valid", () => {
    const data = loadExample("ecommerce.json");
    const result = validate(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate oauth.json as valid", () => {
    const data = loadExample("oauth.json");
    const result = validate(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate readonly.json as valid", () => {
    const data = loadExample("readonly.json");
    const result = validate(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate blog.json as valid", () => {
    const data = loadExample("blog.json");
    const result = validate(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate saas.json as valid", () => {
    const data = loadExample("saas.json");
    const result = validate(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("Invalid input detection", () => {
  it("should reject empty object", () => {
    const result = validate({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should reject non-object input", () => {
    const result = validate("not an object");
    expect(result.valid).toBe(false);
  });

  it("should reject null", () => {
    const result = validate(null);
    expect(result.valid).toBe(false);
  });

  it("should reject array", () => {
    const result = validate([]);
    expect(result.valid).toBe(false);
  });

  it("should reject missing version", () => {
    const result = validate({
      site: { name: "Test", type: "other" },
      api: {
        base_url: "https://example.com/api",
        public: {
          test: { method: "GET", path: "/test", description: "Test" },
        },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("version"))).toBe(
      true
    );
  });

  it("should reject invalid version format", () => {
    const result = validate({
      version: "1.0",
      site: { name: "Test", type: "other" },
      api: {
        base_url: "https://example.com/api",
        public: {
          test: { method: "GET", path: "/test", description: "Test" },
        },
      },
    });
    expect(result.valid).toBe(false);
  });

  it("should reject invalid site type", () => {
    const result = validate({
      version: "1.0.0",
      site: { name: "Test", type: "invalid_type" },
      api: {
        base_url: "https://example.com/api",
        public: {
          test: { method: "GET", path: "/test", description: "Test" },
        },
      },
    });
    expect(result.valid).toBe(false);
  });

  it("should reject api without any endpoint groups", () => {
    const result = validate({
      version: "1.0.0",
      site: { name: "Test", type: "other" },
      api: {
        base_url: "https://example.com/api",
      },
    });
    expect(result.valid).toBe(false);
  });

  it("should reject unknown top-level properties", () => {
    const result = validate({
      version: "1.0.0",
      site: { name: "Test", type: "other" },
      api: {
        base_url: "https://example.com/api",
        public: {
          test: { method: "GET", path: "/test", description: "Test" },
        },
      },
      unknown_field: true,
    });
    expect(result.valid).toBe(false);
  });

  it("should reject invalid HTTP method", () => {
    const result = validate({
      version: "1.0.0",
      site: { name: "Test", type: "other" },
      api: {
        base_url: "https://example.com/api",
        public: {
          test: { method: "INVALID", path: "/test", description: "Test" },
        },
      },
    });
    expect(result.valid).toBe(false);
  });
});

describe("JSON string validation", () => {
  it("should validate valid JSON string", () => {
    const json = JSON.stringify({
      version: "1.0.0",
      site: { name: "Test", type: "other" },
      api: {
        base_url: "https://example.com/api",
        public: {
          test: { method: "GET", path: "/test", description: "Test" },
        },
      },
    });
    const result = validateJson(json);
    expect(result.valid).toBe(true);
  });

  it("should reject invalid JSON string", () => {
    const result = validateJson("{invalid json}");
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("Invalid JSON");
  });
});

describe("Semantic Validation", () => {
  it("should warn when protected endpoints exist without auth", () => {
    const result = validate({
      version: "1.0.0",
      site: { name: "Test", type: "other" },
      api: {
        base_url: "https://example.com/api",
        protected: {
          test: { method: "GET", path: "/test", description: "Test" },
        },
      },
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("auth"))).toBe(true);
  });

  it("should warn when user_required endpoints exist without OAuth2", () => {
    const result = validate({
      version: "1.0.0",
      site: { name: "Test", type: "other" },
      api: {
        base_url: "https://example.com/api",
        user_required: {
          test: { method: "GET", path: "/test", description: "Test" },
        },
      },
      auth: {
        signed_key: {
          register_url: "https://example.com/ia/register",
          algorithm: "sha256",
        },
      },
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("OAuth2"))).toBe(
      true
    );
  });
});

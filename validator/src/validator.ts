import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runSemanticValidation, type SemanticError } from "./semantic.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  schema_version: string;
}

export interface ValidationError {
  path: string;
  message: string;
  severity: "error";
}

export interface ValidationWarning {
  path: string;
  message: string;
  severity: "warning";
}

function loadSchema(filename: string): object {
  const schemaDir = resolve(__dirname, "../../schema");
  const content = readFileSync(resolve(schemaDir, filename), "utf-8");
  return JSON.parse(content);
}

function loadAllSchemas(): { rootSchema: object; ajv: Ajv2020 } {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    verbose: true,
  });
  addFormats(ajv);

  // Load sub-schemas first so $ref can resolve
  const subSchemas = [
    "defs/common.schema.json",
    "defs/site.schema.json",
    "defs/api.schema.json",
    "defs/auth.schema.json",
    "defs/security.schema.json",
    "defs/capabilities.schema.json",
    "defs/webhooks.schema.json",
    "defs/metadata.schema.json",
  ];

  for (const file of subSchemas) {
    const schema = loadSchema(file);
    ajv.addSchema(schema);
  }

  const rootSchema = loadSchema("ia.schema.json");
  return { rootSchema, ajv };
}

export function validate(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check if data is an object
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {
      valid: false,
      errors: [
        {
          path: "/",
          message: "ia.json must be a JSON object",
          severity: "error",
        },
      ],
      warnings: [],
      schema_version: "1.0.0",
    };
  }

  // Layer 1: Schema validation (AJV)
  const { rootSchema, ajv } = loadAllSchemas();
  const validateFn = ajv.compile(rootSchema);
  const schemaValid = validateFn(data);

  if (!schemaValid && validateFn.errors) {
    for (const err of validateFn.errors) {
      errors.push({
        path: err.instancePath || "/",
        message: formatAjvError(err),
        severity: "error",
      });
    }
  }

  // Layer 2: Semantic validation (only if schema is valid)
  if (schemaValid) {
    const semanticResults = runSemanticValidation(
      data as Record<string, unknown>
    );
    for (const result of semanticResults) {
      if (result.severity === "error") {
        errors.push({
          path: result.path,
          message: result.message,
          severity: "error",
        });
      } else {
        warnings.push({
          path: result.path,
          message: result.message,
          severity: "warning",
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    schema_version: "1.0.0",
  };
}

export function validateJson(jsonString: string): ValidationResult {
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    return {
      valid: false,
      errors: [
        {
          path: "/",
          message: `Invalid JSON: ${(e as Error).message}`,
          severity: "error",
        },
      ],
      warnings: [],
      schema_version: "1.0.0",
    };
  }
  return validate(data);
}

function formatAjvError(err: ErrorObject): string {
  switch (err.keyword) {
    case "required":
      return `Missing required property: ${(err.params as { missingProperty: string }).missingProperty}`;
    case "type":
      return `Expected type ${(err.params as { type: string }).type}`;
    case "enum":
      return `Must be one of: ${((err.params as { allowedValues: string[] }).allowedValues).join(", ")}`;
    case "pattern":
      return `Does not match pattern: ${(err.params as { pattern: string }).pattern}`;
    case "additionalProperties":
      return `Unknown property: ${(err.params as { additionalProperty: string }).additionalProperty}`;
    case "minProperties":
      return `Must have at least ${(err.params as { limit: number }).limit} property`;
    case "anyOf":
      return `Must have at least one of: public, protected, or user_required endpoints`;
    default:
      return err.message || "Validation error";
  }
}

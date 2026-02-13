import type { ValidationResult } from "./validator.js";

export type OutputFormat = "text" | "json" | "compact";

export function formatResult(
  result: ValidationResult,
  format: OutputFormat
): string {
  switch (format) {
    case "json":
      return formatJson(result);
    case "compact":
      return formatCompact(result);
    case "text":
    default:
      return formatText(result);
  }
}

function formatText(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid && result.warnings.length === 0) {
    lines.push("✅ Valid ia.json file");
    lines.push("");
    return lines.join("\n");
  }

  if (result.valid && result.warnings.length > 0) {
    lines.push("✅ Valid ia.json file (with warnings)");
    lines.push("");
  }

  if (!result.valid) {
    lines.push("❌ Invalid ia.json file");
    lines.push("");
  }

  if (result.errors.length > 0) {
    lines.push(`Errors (${result.errors.length}):`);
    for (const err of result.errors) {
      lines.push(`  ✗ ${err.path}: ${err.message}`);
    }
    lines.push("");
  }

  if (result.warnings.length > 0) {
    lines.push(`Warnings (${result.warnings.length}):`);
    for (const warn of result.warnings) {
      lines.push(`  ⚠ ${warn.path}: ${warn.message}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatJson(result: ValidationResult): string {
  return JSON.stringify(result, null, 2);
}

function formatCompact(result: ValidationResult): string {
  if (result.valid && result.warnings.length === 0) {
    return "VALID";
  }
  if (result.valid) {
    return `VALID (${result.warnings.length} warnings)`;
  }
  return `INVALID (${result.errors.length} errors, ${result.warnings.length} warnings)`;
}

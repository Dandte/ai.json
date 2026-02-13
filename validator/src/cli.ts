#!/usr/bin/env node
import { Command } from "commander";
import { loadFromSource } from "./loader.js";
import { validateJson } from "./validator.js";
import { formatResult, type OutputFormat } from "./reporter.js";

const program = new Command();

program
  .name("ia-json-validate")
  .description("Validate ia.json files against the official schema")
  .version("1.0.0")
  .argument("<source>", "File path, URL, or - for stdin")
  .option("-f, --format <format>", "Output format: text, json, compact", "text")
  .option("-q, --quiet", "Only output errors (suppress warnings)")
  .action(async (source: string, options: { format: string; quiet?: boolean }) => {
    try {
      const content = await loadFromSource(source);
      const result = validateJson(content);

      if (options.quiet) {
        result.warnings = [];
      }

      const output = formatResult(result, options.format as OutputFormat);
      console.log(output);

      process.exit(result.valid ? 0 : 1);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(2);
    }
  });

program
  .command("serve")
  .description("Start the validation API server")
  .option("-p, --port <port>", "Port to listen on", "3000")
  .action(async (options: { port: string }) => {
    const { startServer } = await import("./server.js");
    startServer(parseInt(options.port, 10));
  });

program.parse();

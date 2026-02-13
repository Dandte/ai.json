import { readFileSync } from "node:fs";

export async function loadFromSource(source: string): Promise<string> {
  if (source === "-" || source === "--stdin") {
    return readFromStdin();
  }

  if (source.startsWith("http://") || source.startsWith("https://")) {
    return fetchFromUrl(source);
  }

  return readFromFile(source);
}

function readFromFile(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      throw new Error(`File not found: ${path}`);
    }
    throw new Error(`Failed to read file: ${error.message}`);
  }
}

async function fetchFromUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "ia-json-validator/1.0.0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("application/json") &&
      !contentType.includes("text/")
    ) {
      throw new Error(
        `Unexpected content type: ${contentType}. Expected application/json`
      );
    }

    return await response.text();
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`Request timed out after 10 seconds: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function readFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
    process.stdin.on("error", reject);
  });
}

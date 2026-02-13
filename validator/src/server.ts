import express from "express";
import { validate, validateJson } from "./validator.js";
import { loadFromSource } from "./loader.js";

export function startServer(port: number = 3000): void {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // CORS headers
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: "1.0.0" });
  });

  app.post("/validate", async (req, res) => {
    try {
      const { content, url } = req.body;

      if (!content && !url) {
        res.status(400).json({
          error: {
            code: "missing_input",
            message:
              'Provide either "content" (ia.json object or string) or "url" (URL to fetch)',
          },
        });
        return;
      }

      let result;

      if (url) {
        try {
          const fetched = await loadFromSource(url);
          result = validateJson(fetched);
        } catch (err) {
          res.status(400).json({
            error: {
              code: "fetch_error",
              message: `Failed to fetch URL: ${(err as Error).message}`,
            },
          });
          return;
        }
      } else if (typeof content === "string") {
        result = validateJson(content);
      } else {
        result = validate(content);
      }

      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: {
          code: "internal_error",
          message: (err as Error).message,
        },
      });
    }
  });

  app.listen(port, () => {
    console.log(`ia.json validator API running on http://localhost:${port}`);
    console.log(`POST /validate - Validate an ia.json file`);
    console.log(`GET /health    - Health check`);
  });
}

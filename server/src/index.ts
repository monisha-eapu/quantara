import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ZodError } from "zod";
import { config, paths } from "./config.js";
import { ensureSigners } from "./crypto/keystore.js";
import { assertPqcAvailable } from "./crypto/schemes.js";
import { api } from "./routes/api.js";
import { quantum } from "./routes/quantum.js";
import { HttpError } from "./services/errors.js";
import { runIntegrityScan } from "./services/integrity.js";
import { isSeeded, seedDemoData } from "./seed.js";

assertPqcAvailable();
ensureSigners();
if (!isSeeded()) {
  console.log("[quantumshield] empty database — seeding fictional demo data");
  seedDemoData((m) => console.log(`[quantumshield] ${m}`));
} else {
  const scan = runIntegrityScan("System (startup)");
  console.log(`[quantumshield] startup integrity scan: ${scan.entities} entities, ${scan.tampered} tampered, ledger ${scan.chainValid ? "intact" : "BROKEN"} (${scan.durationMs} ms)`);
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));
app.use("/api/quantum", quantum);
app.use("/api", api);
app.use("/api", (_req, res) => res.status(404).json({ error: "NOT_FOUND", message: "Unknown API route" }));

// Serve the built frontend in production mode.
if (existsSync(paths.webDist)) {
  app.use(express.static(paths.webDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(resolve(paths.webDist, "index.html")));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "), issues: err.issues });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message });
  if (err instanceof SyntaxError) return res.status(400).json({ error: "BAD_JSON", message: "Request body is not valid JSON" });
  console.error(err);
  return res.status(500).json({ error: "INTERNAL", message: (err as Error).message ?? "Internal error" });
});

app.listen(config.port, "127.0.0.1", () => {
  console.log(`[quantumshield] API listening on http://127.0.0.1:${config.port}`);
});

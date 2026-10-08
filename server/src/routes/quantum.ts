import { Router } from "express";
import { config } from "../config.js";
import { logAudit } from "../services/audit.js";

/**
 * Thin proxy to the separate Python/Qiskit quantum service. The quantum service is a THREAT
 * DEMONSTRATION only: it never sees records, keys, or signatures, and the security layer does not
 * depend on it.
 */
export const quantum = Router();

quantum.use(async (req, res) => {
  const url = `${config.quantumServiceUrl}${req.url}`;
  const isSubmit = req.method === "POST" && req.path === "/jobs";
  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: { "content-type": "application/json" },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(180_000),
    });
    const text = await upstream.text();
    if (isSubmit) {
      let body: { id?: string; target?: string; backend?: string; circuit?: string; status?: string; detail?: string } = {};
      try { body = JSON.parse(text); } catch { /* non-JSON error body */ }
      logAudit({
        actor: "Demo User",
        action: "QUANTUM_JOB_SUBMITTED",
        recordId: body.id ?? null,
        result: upstream.ok ? "INFO" : "FAILED",
        details: upstream.ok ? `Circuit ${body.circuit} → ${body.target} (${body.backend}); status ${body.status}` : `Submission failed: ${body.detail ?? upstream.status}`,
      });
    }
    res.status(upstream.status).type(upstream.headers.get("content-type") ?? "application/json").send(text);
  } catch (err) {
    res.status(503).json({
      error: "QUANTUM_SERVICE_OFFLINE",
      message: `The quantum service at ${config.quantumServiceUrl} is not reachable. Start it with "npm run dev:quantum". The ML-DSA security layer is unaffected.`,
      cause: (err as Error).message,
    });
  }
});

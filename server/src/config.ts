import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = resolve(here, "..");
export const REPO_ROOT = resolve(SERVER_ROOT, "..");

// Load the shared repo-level .env (Node >= 20.12 has a built-in loader).
const envFile = resolve(REPO_ROOT, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dataDir: resolve(SERVER_ROOT, process.env.QS_DATA_DIR ?? "data"),
  quantumServiceUrl: process.env.QUANTUM_SERVICE_URL ?? "http://127.0.0.1:8001",
  /** Total number of signed entities the demo seed produces (land + products + events). */
  seedTargetTotal: Number(process.env.QS_SEED_TOTAL ?? 2481),
};

export const paths = {
  db: resolve(config.dataDir, "quantumshield.db"),
  keys: resolve(config.dataDir, "keys"),
  webDist: resolve(REPO_ROOT, "web", "dist"),
};

mkdirSync(paths.keys, { recursive: true, mode: 0o700 });

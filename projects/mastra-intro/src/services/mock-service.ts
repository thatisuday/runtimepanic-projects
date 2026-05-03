import "@dotenvx/dotenvx/config";
import express from "express";

const app = express();

// Each instance is launched by PM2 (see ecosystem.config.cjs) with its own
// SERVICE_NAME, PORT, and optional FAIL_AFTER_MS env variables.
const SERVICE_NAME = process.env.SERVICE_NAME ?? "unknown";
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const FAIL_AFTER_MS = process.env.FAIL_AFTER_MS
  ? parseInt(process.env.FAIL_AFTER_MS, 10)
  : null;

const startedAt = Date.now();

// Simulate a crashed service by exiting after a delay.
// PM2 will not restart it because autorestart is disabled in ecosystem.config.cjs.
if (FAIL_AFTER_MS !== null) {
  setTimeout(() => {
    console.log(`[${SERVICE_NAME}] simulating crash`);
    process.exit(1);
  }, FAIL_AFTER_MS);
}

app.get("/health", (_req, res) => {
  const uptime = Math.floor((Date.now() - startedAt) / 1000);
  res.json({ service: SERVICE_NAME, port: PORT, status: "up", uptime });
});

app.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] running on port ${PORT}`);
});

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { execSync } from "child_process";
import logger from "../logger.js";

// Service registry - maps each mock service name to its local port.
export const SERVICE_PORTS: Record<string, number> = {
  "auth-service": 4001,
  "payment-service": 4002,
  "notification-service": 4003,
  "inventory-service": 4004,
  "reporting-service": 4005,
};

export const ALL_SERVICES = Object.keys(SERVICE_PORTS);

// Shared schema used by both tools and the workflow to describe a single service's health snapshot.
export const ServiceHealthSchema = z.object({
  service: z.string(),
  port: z.number(),
  status: z.enum(["up", "down", "unreachable"]),
  uptime: z.number().optional(),
  error: z.string().optional(),
});

export type ServiceHealthResponse = z.infer<typeof ServiceHealthSchema>;

// Hits the /health endpoint of a single service. Returns "unreachable" on network failure.
async function pingService(name: string): Promise<ServiceHealthResponse> {
  const log = logger.child({ fn: "pingService" });
  const port = SERVICE_PORTS[name];

  try {
    log.debug({ service: name, port }, "Pinging service health endpoint");
    const res = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(3000),
    });

    const data = (await res.json()) as ServiceHealthResponse;
    log.debug(
      { service: name, status: data.status },
      "Received health response"
    );

    return data;
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    log.error({ service: name, port, error }, "Failed to ping service");

    return { service: name, port, status: "unreachable", error };
  }
}

// Tool: list all known services and their ports.
export const listServices = createTool({
  id: "list_services",
  description: "List all known services and their assigned ports.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    services: z.array(z.object({ service: z.string(), port: z.number() })),
  }),
  execute: async () => ({
    services: Object.entries(SERVICE_PORTS).map(([service, port]) => ({
      service,
      port,
    })),
  }),
});

// Tool: check health of one or more services in parallel.
export const checkServiceStatus = createTool({
  id: "check_service_status",
  description:
    "Ping one or more services and return their health status. Omit `services` to check all.",
  inputSchema: z.object({
    services: z
      .array(z.string())
      .optional()
      .describe("Service names to check. Omit to check all."),
  }),
  outputSchema: z.object({
    results: z.array(ServiceHealthSchema),
  }),
  execute: async (inputData) => {
    const log = logger.child({ fn: "checkServiceStatus" });
    const targets = inputData.services?.length
      ? inputData.services
      : ALL_SERVICES;
    log.info({ targets }, "Checking service health");

    const results = await Promise.all(targets.map(pingService));
    log.debug({ results }, "Health check complete");

    return { results };
  },
});

// Tool: restart one or more services via PM2. Capped at 2 per call to match the agent guardrail.
export const restartService = createTool({
  id: "restart_service",
  description:
    "Restart one or more services via PM2. Maximum 2 services per call.",
  inputSchema: z.object({
    services: z
      .array(z.string())
      .min(1)
      .max(2)
      .describe("Service name(s) to restart. Maximum 2 at once."),
  }),
  outputSchema: z.object({
    restarted: z.array(
      z.object({
        service: z.string(),
        success: z.boolean(),
        error: z.string().optional(),
      })
    ),
  }),
  execute: async (inputData) => {
    const log = logger.child({ fn: "restartService" });
    log.info({ services: inputData.services }, "Restarting services via PM2");

    const restarted = inputData.services.map((name: string) => {
      try {
        execSync(`yarn pm2 restart ${name}`, {
          stdio: "pipe",
          cwd: process.cwd(),
        });
        log.info({ service: name }, "Service restarted successfully");

        return { service: name, success: true };
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        log.error({ service: name, error }, "Failed to restart service");

        return { service: name, success: false, error };
      }
    });

    // Give services a moment to bind their ports before the agent checks health again
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return { restarted };
  },
});

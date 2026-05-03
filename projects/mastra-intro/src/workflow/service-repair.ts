import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
  checkServiceStatus,
  restartService,
  ALL_SERVICES,
  ServiceHealthSchema,
  type ServiceHealthResponse,
} from "../tools/service-tools.js";
import { slackNotifier } from "../agents/slack-notifier.js";
import logger from "../logger.js";

// Shared state schema - written by checkInitialHealth, read by sendRepairSummary
const WorkflowStateSchema = z.object({
  failingServices: z.array(z.string()).optional(),
});

// Shared output schema for both branches so buildRepairReport receives a consistent shape
const RepairResultSchema = z.object({
  statuses: z.array(ServiceHealthSchema),
  restarted: z.array(z.string()),
  errors: z.array(z.object({ service: z.string(), error: z.string() })),
});

// Step 1: Check initial health of all target services
const checkInitialHealth = createStep({
  id: "check_initial_health",
  stateSchema: WorkflowStateSchema,
  inputSchema: z.object({
    services: z.array(z.string()),
  }),
  outputSchema: z.object({
    statuses: z.array(ServiceHealthSchema),
    failingServices: z.array(z.string()),
  }),
  execute: async ({ inputData, requestContext, setState }) => {
    const log = logger.child({ fn: "checkInitialHealth" });
    const targets = inputData.services.length
      ? inputData.services
      : ALL_SERVICES;

    log.info({ targets }, "Checking initial service health");
    const { results } = await checkServiceStatus.execute!(
      { services: targets },
      { requestContext }
    );

    const failingServices = results
      .filter((r: ServiceHealthResponse) => r.status !== "up")
      .map((r: ServiceHealthResponse) => r.service);

    await setState({ failingServices });
    log.debug({ failingServices }, "Initial health check complete");
    return { statuses: results, failingServices };
  },
});

// Step 2: Restart failing services in batches of 2
const restartFailingServices = createStep({
  id: "restart_failing_services",
  inputSchema: z.object({
    statuses: z.array(ServiceHealthSchema),
    failingServices: z.array(z.string()),
  }),
  outputSchema: z.object({
    restarted: z.array(z.string()),
    skipped: z.array(z.string()),
    errors: z.array(z.object({ service: z.string(), error: z.string() })),
  }),
  execute: async ({ inputData, requestContext }) => {
    const log = logger.child({ fn: "restartFailingServices" });
    const { failingServices } = inputData;

    log.info(
      { failingServices },
      "Restarting failing services in batches of 2"
    );

    const restarted: string[] = [];
    const errors: { service: string; error: string }[] = [];

    // Restart in batches of 2 (tool enforces max 2)
    for (let i = 0; i < failingServices.length; i += 2) {
      const batch = failingServices.slice(i, i + 2);
      log.debug({ batch }, "Restarting batch");

      const { restarted: batchResult } = await restartService.execute!(
        { services: batch },
        { requestContext }
      );

      batchResult.forEach(
        (r: { service: string; success: boolean; error?: string }) => {
          if (r.success) {
            restarted.push(r.service);
          } else {
            log.error(
              { service: r.service, error: r.error },
              "Service restart failed"
            );
            errors.push({
              service: r.service,
              error: r.error ?? "unknown error",
            });
          }
        }
      );
    }

    return { restarted, skipped: [], errors };
  },
});

// Step 3: Re-check health after restarts; passes restarted/errors through for the final report
const checkFinalHealth = createStep({
  id: "check_final_health",
  inputSchema: z.object({
    restarted: z.array(z.string()),
    skipped: z.array(z.string()),
    errors: z.array(z.object({ service: z.string(), error: z.string() })),
  }),
  outputSchema: RepairResultSchema,
  execute: async ({
    inputData,
    requestContext,
  }): Promise<z.infer<typeof RepairResultSchema>> => {
    const log = logger.child({ fn: "checkFinalHealth" });
    log.info("Checking service health after restarts");

    const { results } = (await checkServiceStatus.execute!(
      { services: ALL_SERVICES },
      { requestContext }
    )) as { results: ServiceHealthResponse[] };

    log.debug({ results }, "Final health check complete");
    return {
      statuses: results,
      restarted: inputData.restarted,
      errors: inputData.errors,
    };
  },
});

// Branch B: all services healthy - passes through the initial statuses in the same shape
const passHealthyStatus = createStep({
  id: "pass_healthy_status",
  inputSchema: z.object({
    statuses: z.array(ServiceHealthSchema),
    failingServices: z.array(z.string()),
  }),
  outputSchema: RepairResultSchema,
  execute: async ({ inputData }) => ({
    statuses: inputData.statuses,
    restarted: [],
    errors: [],
  }),
});

// Final step: sends a Slack notification with repair results if services were failing;
// returns immediately without suspending if all services were already healthy
const sendRepairSummary = createStep({
  id: "send_repair_summary",
  stateSchema: WorkflowStateSchema,
  suspendSchema: z.object({
    prompt: z.string().describe("Approval request shown to the human operator"),
    notification: z
      .string()
      .describe("The Slack message that will be sent if approved"),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
  }),
  inputSchema: z.object({
    repair_workflow: RepairResultSchema.optional(),
    pass_healthy_status: RepairResultSchema.optional(),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    message: z.string().optional(),
  }),
  execute: async ({ inputData, suspend, resumeData, state }) => {
    const log = logger.child({ fn: "sendRepairSummary" });

    const data = inputData.repair_workflow ?? inputData.pass_healthy_status;
    const failing = state?.failingServices ?? [];
    const restarted = data?.restarted ?? [];

    // No repairs needed - return immediately, no suspension
    if (!failing.length) {
      log.info("All services healthy, no notification needed");
      return {
        sent: false,
        message: "All services healthy, no repair needed.",
      };
    }

    const summary = `Service repair complete. Checked ${
      data?.statuses.length ?? 0
    } services. Failing: ${failing.join(", ")}. Restarted: ${
      restarted.join(", ") || "none"
    }.`;

    const slackMessage = [
      `*⚙️ Service Repair Report*`,
      `*Checked:* ${data?.statuses.length ?? 0} services`,
      `*Failing:* ${failing.join(", ")}`,
      `*Restarted:* ${restarted.join(", ") || "none"}`,
    ].join("\n");

    if (!resumeData) {
      log.info("Suspending workflow pending Slack notification approval");
      return suspend({
        prompt:
          "The service repair workflow has completed. Approve sending the Slack notification with the results?",
        notification: summary,
      });
    }

    if (!resumeData.approved) {
      log.info("Slack notification rejected by user");
      return { sent: false, message: "Notification cancelled by user." };
    }

    log.info("Slack notification approved, sending...");
    await slackNotifier.generate(
      `Post this message to Slack channel ${process.env.SLACK_CHANNEL_ID} exactly once. Do not repeat or rephrase it:\n\n${slackMessage}`
    );
    log.info("Slack notification sent");
    return { sent: true, message: summary };
  },
});

// Nested workflow: runs only when services are failing
const repairWorkflow = createWorkflow({
  id: "repair_workflow",
  inputSchema: z.object({
    statuses: z.array(ServiceHealthSchema),
    failingServices: z.array(z.string()),
  }),
  outputSchema: RepairResultSchema,
})
  .then(restartFailingServices)
  .then(checkFinalHealth)
  .commit();

export const serviceRepairWorkflow = createWorkflow({
  id: "service_repair",
  stateSchema: WorkflowStateSchema,
  inputSchema: z.object({
    services: z
      .array(z.string())
      .describe("Services to target. Empty array = all services."),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    message: z.string().optional(),
  }),
})
  .then(checkInitialHealth)
  .branch([
    [
      async ({ inputData }) => inputData.failingServices.length > 0,
      repairWorkflow,
    ],
    [
      async ({ inputData }) => inputData.failingServices.length === 0,
      passHealthyStatus,
    ],
  ])
  .then(sendRepairSummary)
  .commit();

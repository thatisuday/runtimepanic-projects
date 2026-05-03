import "@dotenvx/dotenvx/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { mastra } from "./mastra.js";
import logger from "./logger.js";

const statusMonitorAgent = mastra.getAgent("statusMonitorAgent");
const serviceRepairWorkflow = mastra.getWorkflow("serviceRepairWorkflow");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Forwards user messages to the agent and returns the text response
app.post("/chat", async (req, res) => {
  const log = logger.child({ fn: "POST /chat" });
  const { message, threadId, resourceId } = req.body as {
    message: string;
    threadId: string;
    resourceId: string;
  };

  if (!message || !threadId || !resourceId) {
    res
      .status(400)
      .json({ error: "message, threadId and resourceId are required" });
    return;
  }

  log.info({ threadId, resourceId }, "Received chat message");
  log.debug({ message }, "User message content");

  try {
    const response = await statusMonitorAgent.generate(message, {
      memory: { thread: threadId, resource: resourceId },
    });

    log.info({ threadId }, "Agent response generated");
    res.json({ text: response.text });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    log.error({ error }, "Agent generation failed");

    res.status(500).json({ error });
  }
});

// Starts the service_repair workflow; returns runId and suspend payload if awaiting approval
app.post("/workflow/start", async (_req, res) => {
  const log = logger.child({ fn: "POST /workflow/start" });
  log.info("Starting service_repair workflow");

  try {
    const run = await serviceRepairWorkflow.createRun();
    const result = await run.start({ inputData: { services: [] } });

    log.debug(
      { runId: run.runId, status: result.status },
      "Workflow run result"
    );

    if (result.status === "suspended") {
      // send_repair_summary is a top-level step so its payload is directly accessible by step ID
      const payload = (result as any).suspendPayload?.send_repair_summary as
        | { prompt: string; notification: string }
        | undefined;

      log.debug({ payload }, "Workflow suspended at send_repair_summary");

      res.json({
        runId: run.runId,
        status: "suspended",
        prompt: payload?.prompt ?? "Approve sending the Slack notification?",
        notification: payload?.notification ?? "",
      });
    } else {
      const message = (result as any).result?.message;
      res.json({ runId: run.runId, status: result.status, message });
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    log.error({ error }, "Workflow start failed");

    res.status(500).json({ error });
  }
});

// Resumes a suspended workflow run with the user's approval decision
app.post("/workflow/resume", async (req, res) => {
  const log = logger.child({ fn: "POST /workflow/resume" });
  const { runId, approved } = req.body as { runId: string; approved: boolean };

  if (!runId || approved === undefined) {
    res.status(400).json({ error: "runId and approved are required" });
    return;
  }

  log.info({ runId, approved }, "Resuming workflow run");

  try {
    const run = await serviceRepairWorkflow.createRun({ runId });
    const result = await run.resume({
      step: "send_repair_summary",
      resumeData: { approved },
    });

    log.debug({ status: result.status }, "Workflow resumed");
    res.json({
      status: result.status,
      result: "result" in result ? result.result : undefined,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    log.error({ error }, "Workflow resume failed");
    res.status(500).json({ error });
  }
});

const PORT = parseInt(process.env.PORT ?? "3000", 10);
app.listen(PORT, () => {
  logger
    .child({ fn: "server" })
    .info(`API server listening on http://localhost:${PORT}`);
});

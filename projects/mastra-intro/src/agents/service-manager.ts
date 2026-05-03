import "@dotenvx/dotenvx/config";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { provider } from "../ai-provider.js";
import {
  checkServiceStatus,
  restartService,
  listServices,
  ALL_SERVICES,
} from "../tools/service-tools.js";
import type { InputProcessor, ProcessInputArgs } from "@mastra/core/processors";
import logger from "../logger.js";

// Guardrail: block restarting more than 2 services at once
const restartLimitGuardrail: InputProcessor = {
  id: "restart_limit_guardrail",
  processInput: (args: ProcessInputArgs) => {
    const lastMsg = args.messages.at(-1);
    if (!lastMsg || lastMsg.role !== "user") return args.messages;

    const raw = lastMsg.content as any;
    const content = (
      typeof raw === "string" ? raw : raw?.content ?? ""
    ).toLowerCase();
    const tooMany =
      /restart\b/i.test(content) &&
      ALL_SERVICES.filter((s) => content.includes(s)).length > 2;

    if (tooMany) {
      logger
        .child({ fn: "restart_limit_guardrail" })
        .warn(
          "Guardrail triggered: more than 2 services requested for restart"
        );
      args.systemMessages.push({
        role: "system",
        content:
          "GUARDRAIL: Only 2 services can be restarted per request. Politely decline and ask the user to specify which 2 to restart.",
      });
    }

    return args.messages;
  },
};

export const statusMonitorAgent = new Agent({
  id: "service_manager",
  name: "Service Manager",
  instructions: `You are an AI-powered DevOps assistant that monitors a set of microservices.

You can:
- List all known services and their ports using the list_services tool.
- Check the health of one or more services using the check_service_status tool.
- Restart failing services using the restart_service tool.

Always confirm with the user before restarting a service. After restarting, check the health again to confirm recovery.`,
  model: provider(),
  tools: {
    listServices,
    checkServiceStatus,
    restartService,
  },
  memory: new Memory({ options: { lastMessages: 20 } }),
  inputProcessors: [restartLimitGuardrail],
});

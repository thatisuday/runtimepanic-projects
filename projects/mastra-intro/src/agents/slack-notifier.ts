import "@dotenvx/dotenvx/config";
import { Agent } from "@mastra/core/agent";
import { MCPClient } from "@mastra/mcp";
import { provider } from "../ai-provider.js";

export const mcp = new MCPClient({
  servers: {
    slack: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-slack"],
      env: {
        SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ?? "",
        SLACK_TEAM_ID: process.env.SLACK_TEAM_ID ?? "",
      },
    },
  },
});

export const slackNotifier = new Agent({
  id: "slack_notifier",
  name: "Slack Notifier",
  instructions: `You send Slack notifications. When given a channel ID and message, post the message to that channel using the available Slack tool. Do not modify the message content.`,
  model: provider(),
  tools: await mcp.listTools(),
});

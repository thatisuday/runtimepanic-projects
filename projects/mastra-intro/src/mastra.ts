import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { statusMonitorAgent } from "./agents/service-manager.js";
import { serviceRepairWorkflow } from "./workflow/service-repair.js";

const storage = new LibSQLStore({
  id: "status_monitor_store",
  url: "file:./data/status-monitor.db",
});

export const mastra = new Mastra({
  agents: { statusMonitorAgent },
  workflows: { serviceRepairWorkflow },
  storage,
});

import { promises as fs } from "node:fs";

import { getAgentBasePath } from "../config/loader";
import { resolveSafePath } from "../utils/path-security";
import type { TelemetryEvent, TelemetryLogger } from "./events";

export function createTelemetryLogger(agentId: string): TelemetryLogger {
  return {
    log: async (event: TelemetryEvent) => {
      const base = getAgentBasePath(agentId);
      const logsDir = resolveSafePath(base, "logs");
      const logFile = resolveSafePath(logsDir, "telemetry.jsonl");
      await fs.mkdir(logsDir, { recursive: true });
      await fs.appendFile(logFile, `${JSON.stringify(event)}\n`, "utf8");
    }
  };
}

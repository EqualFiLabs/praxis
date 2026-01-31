import { promises as fs } from "node:fs";
import path from "node:path";

import type { ChannelEvent } from "./types";
import { getAgentBasePath } from "../config/loader";
import { resolveSafePath } from "../utils/path-security";

export type ChannelEventLogEntry = ChannelEvent & {
  direction?: "inbound" | "outbound";
  sessionKey?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export async function appendChannelEvent(
  agentId: string,
  entry: ChannelEventLogEntry
): Promise<void> {
  const basePath = getAgentBasePath(agentId);
  const logsDir = resolveSafePath(basePath, "logs");
  const logFile = resolveSafePath(logsDir, "channel-events.jsonl");
  await fs.mkdir(logsDir, { recursive: true });
  const line = JSON.stringify(entry);
  await fs.appendFile(logFile, `${line}\n`, "utf8");
}

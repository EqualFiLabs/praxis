import fs from "node:fs/promises";
import path from "node:path";

import { getAgentBasePath } from "../config/loader";
import type { TranscriptEntry } from "../types/session";

const TRANSCRIPTS_DIR = "transcripts";
const LOGS_DIR = "logs";
const ACTION_LOG = "agent-actions.jsonl";

function getTranscriptPath(agentId: string, sessionId: string): string {
  return path.join(getAgentBasePath(agentId), TRANSCRIPTS_DIR, `${sessionId}.jsonl`);
}

function getActionLogPath(agentId: string): string {
  return path.join(getAgentBasePath(agentId), LOGS_DIR, ACTION_LOG);
}

export async function append(
  agentId: string,
  sessionId: string,
  entry: TranscriptEntry
): Promise<void> {
  const transcriptPath = getTranscriptPath(agentId, sessionId);
  await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
  const line = `${JSON.stringify(entry)}\n`;
  await fs.appendFile(transcriptPath, line, "utf-8");
}

export async function loadTranscript(
  agentId: string,
  sessionId: string
): Promise<TranscriptEntry[]> {
  const transcriptPath = getTranscriptPath(agentId, sessionId);
  try {
    const raw = await fs.readFile(transcriptPath, "utf-8");
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as TranscriptEntry);
  } catch {
    return [];
  }
}

export async function logAction(agentId: string, entry: TranscriptEntry): Promise<void> {
  const logPath = getActionLogPath(agentId);
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const line = `${JSON.stringify(entry)}\n`;
  await fs.appendFile(logPath, line, "utf-8");
}

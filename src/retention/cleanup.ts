import { promises as fs } from "node:fs";
import path from "node:path";

import type { AgentConfig } from "../types/config";
import { getAgentBasePath } from "../config/loader";
import { resolveSafePath } from "../utils/path-security";

export type RetentionSummary = {
  removed: number;
  checked: number;
};

export async function runRetentionCleanup(
  agentId: string,
  config: AgentConfig
): Promise<RetentionSummary> {
  const base = getAgentBasePath(agentId);
  const retention = config.retention ?? {};
  let removed = 0;
  let checked = 0;

  const targets: Array<{ dir: string; days?: number }> = [
    { dir: "transcripts", days: retention.transcriptsDays },
    { dir: path.join("memory", "decisions"), days: retention.decisionsDays },
    { dir: "logs", days: retention.logsDays },
    { dir: path.join("logs", "telemetry.jsonl"), days: retention.telemetryDays }
  ];

  for (const target of targets) {
    if (!target.days) continue;
    const full = resolveSafePath(base, target.dir);
    const result = await prunePath(full, target.days);
    removed += result.removed;
    checked += result.checked;
  }

  return { removed, checked };
}

export async function prunePath(
  targetPath: string,
  days: number
): Promise<RetentionSummary> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let removed = 0;
  let checked = 0;
  try {
    const stat = await fs.stat(targetPath);
    if (stat.isFile()) {
      checked += 1;
      if (stat.mtimeMs < cutoff) {
        await fs.rm(targetPath);
        removed += 1;
      }
      return { removed, checked };
    }
    if (!stat.isDirectory()) {
      return { removed, checked };
    }
  } catch {
    return { removed, checked };
  }

  const entries = await fs.readdir(targetPath);
  for (const entry of entries) {
    const full = path.join(targetPath, entry);
    const stat = await fs.stat(full);
    if (stat.isDirectory()) {
      const nested = await prunePath(full, days);
      removed += nested.removed;
      checked += nested.checked;
      const remaining = await fs.readdir(full);
      if (remaining.length === 0) {
        await fs.rmdir(full);
      }
      continue;
    }
    checked += 1;
    if (stat.mtimeMs < cutoff) {
      await fs.rm(full);
      removed += 1;
    }
  }

  return { removed, checked };
}

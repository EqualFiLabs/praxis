import fs from "node:fs/promises";
import path from "node:path";

import { getAgentBasePath } from "../config/loader";
import type { Decision, Memory, MemorySearchResult, WeeklyContext } from "../types/memory";
import { stripSensitiveSections, parseSensitiveSections } from "./sensitive";

const MEMORY_FILE = "MEMORY.md";

function getMemoryDir(agentId: string): string {
  return path.join(getAgentBasePath(agentId), "memory");
}

function getMemoryPath(agentId: string): string {
  return path.join(getMemoryDir(agentId), MEMORY_FILE);
}

function getWeeklyPath(agentId: string, date: string): string {
  return path.join(getMemoryDir(agentId), "weekly", `${date}.md`);
}

function getDecisionPath(agentId: string, filename: string): string {
  return path.join(getMemoryDir(agentId), "decisions", filename);
}

function formatDate(value: Date | number): string {
  const date = typeof value === "number" ? new Date(value) : value;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : "decision";
}

export async function loadMemory(agentId: string): Promise<Memory> {
  const memoryPath = getMemoryPath(agentId);
  let raw = "";
  try {
    raw = await fs.readFile(memoryPath, "utf-8");
  } catch {
    raw = "";
  }
  return {
    constraints: [],
    preferences: [],
    raw
  };
}

export async function saveMemory(agentId: string, memory: Memory): Promise<void> {
  const memoryDir = getMemoryDir(agentId);
  await fs.mkdir(memoryDir, { recursive: true });
  const memoryPath = getMemoryPath(agentId);
  await fs.writeFile(memoryPath, memory.raw, "utf-8");
}

export async function searchMemory(agentId: string, query: string): Promise<MemorySearchResult[]> {
  const memory = await loadMemory(agentId);
  const raw = memory.raw;
  if (!query.trim()) return [];
  const lines = raw.split("\n");
  const needle = query.toLowerCase();
  const results: MemorySearchResult[] = [];
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(needle)) {
      results.push({ line: index + 1, text: line });
    }
  });
  return results;
}

export function getSensitiveSections(raw: string) {
  return parseSensitiveSections(raw);
}

export function filterSensitiveMemory(raw: string, allowSensitiveMemory: boolean): string {
  if (allowSensitiveMemory) return raw;
  return stripSensitiveSections(raw);
}

export async function appendDecision(agentId: string, decision: Decision): Promise<string> {
  const date = formatDate(decision.timestamp);
  const slug = slugify(decision.action);
  const filename = `${date}-${slug}.md`;
  const decisionDir = path.join(getMemoryDir(agentId), "decisions");
  await fs.mkdir(decisionDir, { recursive: true });
  const filePath = getDecisionPath(agentId, filename);
  const body = [
    `# Decision: ${decision.action}`,
    "",
    `- **Timestamp**: ${new Date(decision.timestamp).toISOString()}`,
    `- **Action**: ${decision.action}`,
    `- **Rationale**: ${decision.rationale}`,
    decision.outcome ? `- **Outcome**: ${decision.outcome}` : null,
    decision.txHash ? `- **TxHash**: ${decision.txHash}` : null,
    "",
    decision.rationale
  ]
    .filter((line) => line !== null)
    .join("\n");
  await fs.writeFile(filePath, body, "utf-8");
  return filePath;
}

export async function loadWeeklyContext(
  agentId: string,
  date: Date
): Promise<WeeklyContext | null> {
  const dateKey = formatDate(date);
  const filePath = getWeeklyPath(agentId, dateKey);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return { date: dateKey, raw };
  } catch {
    return null;
  }
}

export async function saveWeeklyContext(
  agentId: string,
  context: WeeklyContext
): Promise<void> {
  const weeklyDir = path.join(getMemoryDir(agentId), "weekly");
  await fs.mkdir(weeklyDir, { recursive: true });
  const filePath = getWeeklyPath(agentId, context.date);
  await fs.writeFile(filePath, context.raw, "utf-8");
}

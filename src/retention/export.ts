import { promises as fs } from "node:fs";
import path from "node:path";

import { getAgentBasePath } from "../config/loader";

export async function exportAgentData(agentId: string): Promise<string> {
  const base = getAgentBasePath(agentId);
  const archivePath = path.join(base, `export-${Date.now()}.json`);
  const data = await collectAgentData(base);
  await fs.writeFile(archivePath, JSON.stringify(data, null, 2), "utf8");
  return archivePath;
}

export async function purgeAgentData(agentId: string): Promise<void> {
  const base = getAgentBasePath(agentId);
  await fs.rm(base, { recursive: true, force: true });
}

async function collectAgentData(baseDir: string): Promise<Record<string, unknown>> {
  const entries = await walkDir(baseDir);
  const result: Record<string, unknown> = {};
  for (const entry of entries) {
    const rel = path.relative(baseDir, entry);
    try {
      const content = await fs.readFile(entry, "utf8");
      result[rel] = content;
    } catch {
      continue;
    }
  }
  return result;
}

async function walkDir(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkDir(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

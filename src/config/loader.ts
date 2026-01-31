import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import yaml from "yaml";

import type { AgentConfig } from "../types/config";
import { AgentConfigSchema } from "../types/config";

const CONFIG_BASENAME_YAML = "config.yaml";
const CONFIG_BASENAME_JSON = "config.json";

export function getAgentBasePath(agentId: string): string {
  const trimmed = agentId.trim();
  if (!trimmed) {
    throw new Error("agentId is required");
  }
  const home = process.env.EQUALIS_HOME ?? os.homedir();
  return path.join(home, ".equalis", "agents", trimmed);
}

async function readConfigFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf-8");
  if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
    return yaml.parse(raw);
  }
  return JSON.parse(raw);
}

export async function loadConfig(agentId: string): Promise<AgentConfig> {
  const base = getAgentBasePath(agentId);
  const yamlPath = path.join(base, CONFIG_BASENAME_YAML);
  const jsonPath = path.join(base, CONFIG_BASENAME_JSON);

  const candidates = [yamlPath, jsonPath];
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (!stat.isFile()) continue;
      const parsed = await readConfigFile(candidate);
      return validateConfig(parsed);
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : "unknown error";
  throw new Error(
    `Config not found or invalid for agent ${agentId}. Tried ${CONFIG_BASENAME_YAML} and ${CONFIG_BASENAME_JSON}. Last error: ${detail}`
  );
}

export function validateConfig(config: unknown): AgentConfig {
  return AgentConfigSchema.parse(config);
}

import { describe, expect, it } from "vitest";
import os from "node:os";
import type { AgentConfig } from "../../src/types/config";
import { normalizeConfig } from "../../src/config/normalized";

function baseConfig(): AgentConfig {
  return {
    agent: { id: "agent", profile: "default" },
    auth: { ownerKeyEnv: "OWNER_KEY" },
    inference: {
      provider: "ollama",
      privacy: { allowExternal: false, allowSensitiveMemory: false }
    },
    providers: {
      ollama: {
        type: "ollama",
        baseUrl: "http://localhost",
        model: "llama3",
        contextWindow: 1000,
        maxOutputTokens: 100,
        timeoutMs: 1000
      },
      external: {
        type: "external",
        baseUrl: "http://localhost",
        model: "gpt",
        contextWindow: 1000,
        maxOutputTokens: 100,
        timeoutMs: 1000,
        apiKeyEnv: "OPENAI_API_KEY"
      }
    },
    chain: {
      rpcUrl: "http://localhost",
      chainId: 1,
      tbaAddress: "0x123",
      positionNftAddress: "0x456",
      positionTokenId: "1"
    }
  };
}

describe("normalizeConfig", () => {
  it("expands ~ in whatsapp sessionDir", () => {
    const cfg = baseConfig();
    cfg.channels = {
      whatsapp: { enabled: true, sessionDir: "~/whatsapp", allowFrom: [] }
    };
    const normalized = normalizeConfig(cfg);
    expect(normalized.channels?.whatsapp?.sessionDir).toBe(
      os.homedir() + "/whatsapp"
    );
  });

  it("defaults allowFrom and mention patterns", () => {
    const cfg = baseConfig();
    cfg.channels = {
      telegram: { enabled: true, botTokenEnv: "TELEGRAM_TOKEN" }
    };
    const normalized = normalizeConfig(cfg);
    expect(normalized.channels?.telegram?.allowFrom).toEqual([]);
    expect(normalized.channels?.telegram?.mentionPatterns).toEqual([]);
    expect(normalized.channels?.telegram?.requireMentionInGroups).toBe(false);
  });

  it("throws when provider config missing", () => {
    const cfg = baseConfig();
    cfg.inference.provider = "external";
    cfg.providers.external = undefined;
    expect(() => normalizeConfig(cfg)).toThrow();
  });
});

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { probeChannels } from "../../src/channels/status";
import type { AgentConfig } from "../../src/types/config";

const baseConfig: AgentConfig = {
  agent: { id: "agent", profile: "test" },
  auth: { ownerKeyEnv: "OWNER_KEY" },
  inference: {
    provider: "ollama",
    privacy: { allowExternal: false, allowSensitiveMemory: false }
  },
  providers: {},
  chain: {
    rpcUrl: "http://localhost",
    chainId: 1,
    tbaAddress: "0x123",
    positionNftAddress: "0x456",
    positionTokenId: "1"
  }
};

describe("probeChannels", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("reports missing env vars as issues", () => {
    const config: AgentConfig = {
      ...baseConfig,
      channels: {
        telegram: { enabled: true, botTokenEnv: "TELEGRAM_TOKEN" },
        discord: { enabled: true, botTokenEnv: "DISCORD_TOKEN", publicKeyEnv: "DISCORD_PUB" },
        whatsapp: { enabled: true, sessionDir: "phone", provider: "cloud" }
      }
    };
    const status = probeChannels(config);
    const telegram = status.find((entry) => entry.channelId === "telegram");
    const discord = status.find((entry) => entry.channelId === "discord");
    const whatsapp = status.find((entry) => entry.channelId === "whatsapp");
    expect(telegram?.ok).toBe(false);
    expect(discord?.ok).toBe(false);
    expect(whatsapp?.ok).toBe(false);
  });

  it("passes when required env vars are present", () => {
    process.env.TELEGRAM_TOKEN = "tok";
    process.env.DISCORD_TOKEN = "tok";
    process.env.DISCORD_PUB = "abcd";
    process.env.WHATSAPP_ACCESS_TOKEN = "tok";
    const config: AgentConfig = {
      ...baseConfig,
      channels: {
        telegram: { enabled: true, botTokenEnv: "TELEGRAM_TOKEN" },
        discord: { enabled: true, botTokenEnv: "DISCORD_TOKEN", publicKeyEnv: "DISCORD_PUB" },
        whatsapp: { enabled: true, sessionDir: "phone", provider: "cloud" }
      }
    };
    const status = probeChannels(config);
    expect(status.every((entry) => entry.ok)).toBe(true);
  });
});

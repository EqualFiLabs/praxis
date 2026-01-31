import os from "node:os";
import path from "node:path";

import type { AgentConfig, ChannelsConfig } from "../types/config";
import { assertEnvVarName } from "../utils/secrets";
import { getAgentBasePath } from "./loader";
import { normalizeChannelsConfigFromPartial, type NormalizedChannels } from "./normalize-channels";

export type NormalizedConfig = AgentConfig & {
  paths: {
    baseDir: string;
    memoryDir: string;
    logsDir: string;
  };
  channelsNormalized: NormalizedChannels;
};

export function normalizeConfig(config: AgentConfig): NormalizedConfig {
  validateProviderInvariants(config);
  validateEnvVarNames(config);

  const baseDir = getAgentBasePath(config.agent.id);
  const channels = normalizeChannels(config.channels);
  const channelsNormalized = normalizeChannelsConfigFromPartial(channels);

  return {
    ...config,
    channels,
    paths: {
      baseDir,
      memoryDir: path.join(baseDir, "memory"),
      logsDir: path.join(baseDir, "logs")
    },
    channelsNormalized
  };
}

function validateProviderInvariants(config: AgentConfig): void {
  const provider = config.inference.provider;
  if (provider === "ollama" && !config.providers.ollama) {
    throw new Error("inference.provider=ollama requires providers.ollama");
  }
  if (provider === "external" && !config.providers.external) {
    throw new Error("inference.provider=external requires providers.external");
  }
  if (config.inference.fallbackProvider) {
    const fallback = config.inference.fallbackProvider;
    if (fallback === "ollama" && !config.providers.ollama) {
      throw new Error("fallbackProvider=ollama requires providers.ollama");
    }
    if (fallback === "external" && !config.providers.external) {
      throw new Error("fallbackProvider=external requires providers.external");
    }
  }
}

function validateEnvVarNames(config: AgentConfig): void {
  assertEnvVarName(config.auth.ownerKeyEnv, "ownerKeyEnv");

  if (config.providers.ollama?.apiKeyEnv) {
    assertEnvVarName(config.providers.ollama.apiKeyEnv, "ollama apiKeyEnv");
  }
  if (config.providers.external?.apiKeyEnv) {
    assertEnvVarName(config.providers.external.apiKeyEnv, "external apiKeyEnv");
  }

  const adapters = config.providers.external?.adapters;
  if (adapters?.anthropic?.apiKeyEnv) {
    assertEnvVarName(adapters.anthropic.apiKeyEnv, "anthropic apiKeyEnv");
  }
  if (adapters?.google?.apiKeyEnv) {
    assertEnvVarName(adapters.google.apiKeyEnv, "google apiKeyEnv");
  }

  const channels = config.channels;
  if (channels?.telegram?.botTokenEnv) {
    assertEnvVarName(channels.telegram.botTokenEnv, "telegram botTokenEnv");
  }
  if (channels?.discord?.botTokenEnv) {
    assertEnvVarName(channels.discord.botTokenEnv, "discord botTokenEnv");
  }
  if (channels?.discord?.publicKeyEnv) {
    assertEnvVarName(channels.discord.publicKeyEnv, "discord publicKeyEnv");
  }
  if (channels?.telegram?.accounts) {
    for (const account of Object.values(channels.telegram.accounts)) {
      assertEnvVarName(account.botTokenEnv, "telegram account botTokenEnv");
    }
  }
  if (channels?.discord?.accounts) {
    for (const account of Object.values(channels.discord.accounts)) {
      assertEnvVarName(account.botTokenEnv, "discord account botTokenEnv");
      if (account.publicKeyEnv) {
        assertEnvVarName(account.publicKeyEnv, "discord account publicKeyEnv");
      }
    }
  }
}

function normalizeChannels(channels?: ChannelsConfig): ChannelsConfig | undefined {
  if (!channels) return undefined;
  return {
    telegram: normalizeTelegramChannel(channels.telegram),
    discord: normalizeDiscordChannel(channels.discord),
    whatsapp: normalizeWhatsAppChannel(channels.whatsapp)
  };
}

function normalizeTelegramChannel(
  channel: ChannelsConfig["telegram"]
): ChannelsConfig["telegram"] | undefined {
  if (!channel) return undefined;
  return {
    ...channel,
    allowFrom: normalizeList(channel.allowFrom),
    mentionPatterns: normalizeList(channel.mentionPatterns),
    requireMentionInGroups: channel.requireMentionInGroups ?? false,
    accounts: normalizeAccounts(channel.accounts, (entry) => ({
      ...entry,
      allowFrom: normalizeList(entry.allowFrom),
      mentionPatterns: normalizeList(entry.mentionPatterns),
      requireMentionInGroups: entry.requireMentionInGroups ?? false
    }))
  };
}

function normalizeDiscordChannel(
  channel: ChannelsConfig["discord"]
): ChannelsConfig["discord"] | undefined {
  if (!channel) return undefined;
  return {
    ...channel,
    allowFrom: normalizeList(channel.allowFrom),
    mentionPatterns: normalizeList(channel.mentionPatterns),
    requireMentionInGroups: channel.requireMentionInGroups ?? false,
    accounts: normalizeAccounts(channel.accounts, (entry) => ({
      ...entry,
      allowFrom: normalizeList(entry.allowFrom),
      mentionPatterns: normalizeList(entry.mentionPatterns),
      requireMentionInGroups: entry.requireMentionInGroups ?? false
    }))
  };
}

function normalizeWhatsAppChannel(
  channel: ChannelsConfig["whatsapp"]
): ChannelsConfig["whatsapp"] | undefined {
  if (!channel) return undefined;
  return {
    ...channel,
    sessionDir: expandHome(channel.sessionDir),
    allowFrom: normalizeList(channel.allowFrom),
    mentionPatterns: normalizeList(channel.mentionPatterns),
    requireMentionInGroups: channel.requireMentionInGroups ?? false,
    accounts: normalizeAccounts(channel.accounts, (entry) => ({
      ...entry,
      sessionDir: expandHome(entry.sessionDir),
      allowFrom: normalizeList(entry.allowFrom),
      mentionPatterns: normalizeList(entry.mentionPatterns),
      requireMentionInGroups: entry.requireMentionInGroups ?? false
    }))
  };
}

function normalizeList(values?: string[]): string[] {
  if (!values) return [];
  return values.map((value) => value.trim()).filter(Boolean);
}

function normalizeAccounts<T extends Record<string, unknown>>(
  accounts: Record<string, T> | undefined,
  map: (entry: T) => T
): Record<string, T> | undefined {
  if (!accounts) return undefined;
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(accounts)) {
    next[key] = map(value);
  }
  return next;
}

function expandHome(input: string): string {
  if (!input) return input;
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

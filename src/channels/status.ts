import type { AgentConfig } from "../types/config";
import { resolveSecretFromEnv } from "../utils/secrets";

export type ChannelStatus = {
  channelId: string;
  enabled: boolean;
  ok: boolean;
  issues: string[];
};

export function probeChannels(config: AgentConfig): ChannelStatus[] {
  const statuses: ChannelStatus[] = [];
  statuses.push(probeTelegram(config));
  statuses.push(probeDiscord(config));
  statuses.push(probeWhatsApp(config));
  return statuses;
}

function probeTelegram(config: AgentConfig): ChannelStatus {
  const channel = config.channels?.telegram;
  const enabled = Boolean(channel?.enabled);
  const issues: string[] = [];
  if (!enabled) {
    return { channelId: "telegram", enabled: false, ok: true, issues };
  }
  if (!channel?.botTokenEnv) {
    issues.push("botTokenEnv not configured");
  } else {
    try {
      resolveSecretFromEnv(channel.botTokenEnv, "telegram bot token");
    } catch {
      issues.push(`missing env: ${channel.botTokenEnv}`);
    }
  }
  return { channelId: "telegram", enabled, ok: issues.length === 0, issues };
}

function probeDiscord(config: AgentConfig): ChannelStatus {
  const channel = config.channels?.discord;
  const enabled = Boolean(channel?.enabled);
  const issues: string[] = [];
  if (!enabled) {
    return { channelId: "discord", enabled: false, ok: true, issues };
  }
  if (!channel?.botTokenEnv) {
    issues.push("botTokenEnv not configured");
  } else {
    try {
      resolveSecretFromEnv(channel.botTokenEnv, "discord bot token");
    } catch {
      issues.push(`missing env: ${channel.botTokenEnv}`);
    }
  }
  if (channel?.publicKeyEnv) {
    try {
      resolveSecretFromEnv(channel.publicKeyEnv, "discord public key");
    } catch {
      issues.push(`missing env: ${channel.publicKeyEnv}`);
    }
  }
  return { channelId: "discord", enabled, ok: issues.length === 0, issues };
}

function probeWhatsApp(config: AgentConfig): ChannelStatus {
  const channel = config.channels?.whatsapp;
  const enabled = Boolean(channel?.enabled);
  const issues: string[] = [];
  if (!enabled) {
    return { channelId: "whatsapp", enabled: false, ok: true, issues };
  }
  if (!channel?.sessionDir) {
    issues.push("sessionDir not configured");
  }
  const provider = channel?.provider ?? "cloud";
  if (provider === "cloud") {
    if (!process.env.WHATSAPP_ACCESS_TOKEN) {
      issues.push("missing env: WHATSAPP_ACCESS_TOKEN");
    }
  }
  return { channelId: "whatsapp", enabled, ok: issues.length === 0, issues };
}

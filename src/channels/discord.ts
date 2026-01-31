import type { ChannelsConfig } from "../types/config";
import { buildSessionKey, isAllowedSender } from "./session-key";

export type DiscordInbound = {
  senderId: string;
  channelId: string;
  text: string;
  threadId?: string;
  isGroup?: boolean;
};

export type ChannelMessage = {
  channel: "discord";
  to: string;
  text: string;
  threadId?: string;
  sessionKey: string;
};

export function normalizeDiscordInbound(
  cfg: ChannelsConfig["discord"],
  inbound: DiscordInbound
): ChannelMessage | null {
  if (!cfg?.enabled) return null;
  if (!isAllowedSender(cfg.allowFrom, inbound.senderId)) return null;
  const sessionKey = buildSessionKey({
    channel: "discord",
    senderId: inbound.senderId,
    groupId: inbound.isGroup ? inbound.channelId : undefined,
    threadId: inbound.threadId
  });
  return {
    channel: "discord",
    to: inbound.channelId,
    text: inbound.text,
    threadId: inbound.threadId,
    sessionKey
  };
}

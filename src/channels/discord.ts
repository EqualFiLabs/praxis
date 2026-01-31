import type { ChannelsConfig } from "../types/config";
import type { InboundMessage, MsgContext } from "./types";
import { applyInboundPolicy } from "./dock";

export type DiscordInbound = {
  senderId: string;
  channelId: string;
  text: string;
  threadId?: string;
  isGroup?: boolean;
};

export function normalizeDiscordInbound(
  cfg: ChannelsConfig["discord"],
  inbound: DiscordInbound
): MsgContext | null {
  if (!cfg?.enabled) return null;
  const message: InboundMessage = {
    channelId: "discord",
    userId: inbound.senderId,
    threadId: inbound.threadId,
    timestamp: new Date().toISOString(),
    content: inbound.text,
    metadata: {
      channelId: inbound.channelId,
      isGroup: inbound.isGroup ?? false
    }
  };
  return applyInboundPolicy("discord", message, {
    allowFrom: cfg.allowFrom
  });
}

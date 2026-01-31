import type { ChannelsConfig } from "../types/config";
import { buildSessionKey, isAllowedSender } from "./session-key";

export type WhatsappInbound = {
  senderId: string;
  chatId: string;
  text: string;
  threadId?: string;
  isGroup?: boolean;
};

export type ChannelMessage = {
  channel: "whatsapp";
  to: string;
  text: string;
  threadId?: string;
  sessionKey: string;
};

export function normalizeWhatsappInbound(
  cfg: ChannelsConfig["whatsapp"],
  inbound: WhatsappInbound
): ChannelMessage | null {
  if (!cfg?.enabled) return null;
  if (!isAllowedSender(cfg.allowFrom, inbound.senderId)) return null;
  const sessionKey = buildSessionKey({
    channel: "whatsapp",
    senderId: inbound.senderId,
    groupId: inbound.isGroup ? inbound.chatId : undefined,
    threadId: inbound.threadId
  });
  return {
    channel: "whatsapp",
    to: inbound.chatId,
    text: inbound.text,
    threadId: inbound.threadId,
    sessionKey
  };
}

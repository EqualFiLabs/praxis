import type { ChannelsConfig } from "../types/config";
import type { InboundMessage, MsgContext } from "./types";
import { applyInboundPolicy } from "./dock";

export type WhatsappInbound = {
  senderId: string;
  chatId: string;
  text: string;
  threadId?: string;
  isGroup?: boolean;
};

export function normalizeWhatsappInbound(
  cfg: ChannelsConfig["whatsapp"],
  inbound: WhatsappInbound
): MsgContext | null {
  if (!cfg?.enabled) return null;
  const message: InboundMessage = {
    channelId: "whatsapp",
    userId: inbound.senderId,
    threadId: inbound.threadId,
    timestamp: new Date().toISOString(),
    content: inbound.text,
    metadata: {
      chatId: inbound.chatId,
      isGroup: inbound.isGroup ?? false
    }
  };
  return applyInboundPolicy("whatsapp", message, {
    allowFrom: cfg.allowFrom
  });
}

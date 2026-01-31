import type { ChannelsConfig } from "../types/config";
import { buildSessionKey, isAllowedSender } from "./session-key";

export type TelegramInbound = {
  senderId: string;
  chatId: string;
  text: string;
  threadId?: string;
  isGroup?: boolean;
};

export type ChannelMessage = {
  channel: "telegram";
  to: string;
  text: string;
  threadId?: string;
  sessionKey: string;
};

export function normalizeTelegramInbound(
  cfg: ChannelsConfig["telegram"],
  inbound: TelegramInbound
): ChannelMessage | null {
  if (!cfg?.enabled) return null;
  if (!isAllowedSender(cfg.allowFrom, inbound.senderId)) return null;
  const sessionKey = buildSessionKey({
    channel: "telegram",
    senderId: inbound.senderId,
    groupId: inbound.isGroup ? inbound.chatId : undefined,
    threadId: inbound.threadId
  });
  return {
    channel: "telegram",
    to: inbound.chatId,
    text: inbound.text,
    threadId: inbound.threadId,
    sessionKey
  };
}

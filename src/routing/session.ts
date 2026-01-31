import type { InboundMessage } from "../channels/types";

export type ChatType = "dm" | "group" | "thread";

export type SessionRoute = {
  channelId: string;
  chatType: ChatType;
  peerId: string;
  threadId?: string;
};

export type SessionKeyInput = {
  channelId: string;
  senderId: string;
  groupId?: string;
  threadId?: string;
};

export function buildSessionKey(input: SessionKeyInput): string {
  if (input.threadId) {
    return `channel:${input.channelId}:thread:${input.threadId}`;
  }
  if (input.groupId) {
    return `channel:${input.channelId}:group:${input.groupId}`;
  }
  return `channel:${input.channelId}:dm:${input.senderId}`;
}

export function resolveSessionRoute(message: InboundMessage): SessionRoute {
  const meta = message.metadata ?? {};
  const isGroup = Boolean(meta.isGroup);
  const groupId =
    (meta.groupId as string | undefined) ??
    (meta.chatId as string | undefined) ??
    undefined;

  if (message.threadId) {
    return {
      channelId: String(message.channelId),
      chatType: "thread",
      peerId: String(groupId ?? message.userId),
      threadId: message.threadId
    };
  }

  if (isGroup || groupId) {
    return {
      channelId: String(message.channelId),
      chatType: "group",
      peerId: String(groupId ?? message.userId)
    };
  }

  return {
    channelId: String(message.channelId),
    chatType: "dm",
    peerId: message.userId
  };
}

export function resolveSessionKey(message: InboundMessage): string {
  const route = resolveSessionRoute(message);
  if (route.chatType === "thread") {
    return buildSessionKey({
      channelId: route.channelId,
      senderId: message.userId,
      groupId: route.peerId,
      threadId: route.threadId
    });
  }
  if (route.chatType === "group") {
    return buildSessionKey({
      channelId: route.channelId,
      senderId: message.userId,
      groupId: route.peerId
    });
  }
  return buildSessionKey({
    channelId: route.channelId,
    senderId: message.userId
  });
}

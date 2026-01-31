import type { MsgContext } from "../channels/types";

export type SessionScope = {
  agentId: string;
  userId: string;
  channelId: string;
  chatType: "dm" | "group" | "thread";
  threadId?: string;
};

export type SessionKey = string;

export function buildSessionKey(scope: SessionScope): SessionKey {
  const base = `agent:${scope.agentId}:channel:${scope.channelId}:type:${scope.chatType}`;
  if (scope.threadId) {
    return `${base}:thread:${scope.threadId}:user:${scope.userId}`;
  }
  return `${base}:user:${scope.userId}`;
}

export function resolveSessionScope(
  agentId: string,
  message: MsgContext
): SessionScope {
  return {
    agentId,
    userId: message.userId,
    channelId: String(message.channelId),
    chatType: message.chatType,
    threadId: message.threadId
  };
}

export type ChannelKind = "telegram" | "whatsapp" | "discord";

export function buildSessionKey(params: {
  channel: ChannelKind;
  senderId: string;
  groupId?: string;
  threadId?: string;
}): string {
  if (params.threadId) {
    return `channel:${params.channel}:thread:${params.threadId}`;
  }
  if (params.groupId) {
    return `channel:${params.channel}:group:${params.groupId}`;
  }
  return `channel:${params.channel}:dm:${params.senderId}`;
}

export function isAllowedSender(allowFrom: string[] | undefined, senderId: string): boolean {
  if (!allowFrom || allowFrom.length === 0) return true;
  return allowFrom.includes(senderId);
}

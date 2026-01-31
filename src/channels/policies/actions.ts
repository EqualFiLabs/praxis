import type { MsgContext } from "../types";

export type ChannelActionPolicy = {
  allow?: string[];
  deny?: string[];
  allowInGroups?: boolean;
  allowInThreads?: boolean;
};

export function isActionAllowed(
  action: string,
  context: MsgContext,
  policy?: ChannelActionPolicy
): boolean {
  if (!policy) return true;
  if (context.chatType === "group" && policy.allowInGroups === false) return false;
  if (context.chatType === "thread" && policy.allowInThreads === false) return false;
  if (policy.deny && policy.deny.includes(action)) return false;
  if (policy.allow && policy.allow.length > 0) {
    return policy.allow.includes(action);
  }
  return true;
}

export function requireActionAllowed(
  action: string,
  context: MsgContext,
  policy?: ChannelActionPolicy
): void {
  if (!isActionAllowed(action, context, policy)) {
    throw new Error(`action not allowed for channel ${context.channelId}`);
  }
}

import type { ChannelId, ChatType, InboundMessage, MsgContext } from "./types";
import { resolveSessionKey, resolveSessionRoute } from "../routing/session";

export type ChannelCapabilities = {
  chatTypes: ChatType[];
  threads?: boolean;
  polls?: boolean;
  reactions?: boolean;
  media?: boolean;
  textChunkLimit?: number;
};

export type ChannelMentionPolicy = {
  requireInGroups?: boolean;
  patterns?: string[];
};

export type ChannelPolicyHooks = {
  formatAllowFrom?: (allowFrom: string[]) => string[];
  resolveChatType?: (message: InboundMessage) => ChatType;
  mentionPolicy?: ChannelMentionPolicy;
};

export type ChannelDock = {
  id: ChannelId;
  capabilities: ChannelCapabilities;
  policies?: ChannelPolicyHooks;
};

const formatLower = (allowFrom: string[]) =>
  allowFrom
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.toLowerCase());

const stripPrefixes = (allowFrom: string[], prefixes: string[]) =>
  allowFrom
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      for (const prefix of prefixes) {
        const regex = new RegExp(`^${prefix}:`, "i");
        if (regex.test(entry)) {
          return entry.replace(regex, "");
        }
      }
      return entry;
    });

const DEFAULT_CAPABILITIES: Record<string, ChannelCapabilities> = {
  telegram: { chatTypes: ["dm", "group", "thread"], threads: true, textChunkLimit: 4000 },
  discord: { chatTypes: ["dm", "group", "thread"], threads: true, textChunkLimit: 2000 },
  whatsapp: { chatTypes: ["dm", "group"], polls: true, reactions: true, media: true, textChunkLimit: 4000 }
};

export const CHANNEL_DOCKS: Record<string, ChannelDock> = {
  telegram: {
    id: "telegram",
    capabilities: DEFAULT_CAPABILITIES.telegram,
    policies: {
      formatAllowFrom: (allowFrom) => stripPrefixes(allowFrom, ["telegram", "tg"]),
      mentionPolicy: { requireInGroups: false, patterns: [] }
    }
  },
  discord: {
    id: "discord",
    capabilities: DEFAULT_CAPABILITIES.discord,
    policies: {
      formatAllowFrom: formatLower,
      mentionPolicy: { requireInGroups: false, patterns: [] }
    }
  },
  whatsapp: {
    id: "whatsapp",
    capabilities: DEFAULT_CAPABILITIES.whatsapp,
    policies: {
      formatAllowFrom: (allowFrom) => stripPrefixes(allowFrom, ["whatsapp"]),
      mentionPolicy: { requireInGroups: false, patterns: [] }
    }
  }
};

export function getChannelDock(channelId: ChannelId): ChannelDock | undefined {
  return CHANNEL_DOCKS[String(channelId)];
}

export type InboundPolicyOptions = {
  allowFrom?: string[];
  mentionPolicy?: ChannelMentionPolicy;
};

export function resolveAllowFrom(channelId: ChannelId, allowFrom?: string[]): string[] {
  const dock = getChannelDock(channelId);
  const entries = allowFrom ?? [];
  if (!dock?.policies?.formatAllowFrom) {
    return entries.map((entry) => entry.trim()).filter(Boolean);
  }
  return dock.policies.formatAllowFrom(entries);
}

export function isAllowedSender(
  channelId: ChannelId,
  allowFrom: string[] | undefined,
  senderId: string
): boolean {
  const normalized = resolveAllowFrom(channelId, allowFrom);
  if (normalized.length === 0) return true;
  return normalized.includes(senderId) || normalized.includes(senderId.toLowerCase());
}

export function applyInboundPolicy(
  channelId: ChannelId,
  inbound: InboundMessage,
  options: InboundPolicyOptions = {}
): MsgContext | null {
  if (!isAllowedSender(channelId, options.allowFrom, inbound.userId)) {
    return null;
  }

  const dock = getChannelDock(channelId);
  const mentionPolicy = options.mentionPolicy ?? dock?.policies?.mentionPolicy;
  const route = resolveSessionRoute(inbound);
  const chatType = dock?.policies?.resolveChatType?.(inbound) ?? route.chatType;

  if (mentionPolicy?.requireInGroups && (chatType === "group" || chatType === "thread")) {
    const mentioned = isMentioned(inbound.content, mentionPolicy.patterns, inbound.metadata);
    if (!mentioned) {
      return null;
    }
  }

  return {
    ...inbound,
    chatType,
    sessionKey: resolveSessionKey(inbound)
  };
}

function isMentioned(
  content: string,
  patterns: string[] | undefined,
  metadata?: Record<string, unknown>
): boolean {
  if (metadata?.mentioned === true) return true;
  if (!patterns || patterns.length === 0) return false;
  const lower = content.toLowerCase();
  return patterns.some((pattern) => {
    if (!pattern) return false;
    try {
      const regex = new RegExp(pattern, "i");
      return regex.test(content);
    } catch {
      return lower.includes(pattern.toLowerCase());
    }
  });
}

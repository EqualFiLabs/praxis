import type { ChannelId, InboundMessage } from "./types";

export type ChannelChatType = "dm" | "group" | "thread";

export type ChannelCapabilities = {
  chatTypes: ChannelChatType[];
  threads?: boolean;
  polls?: boolean;
  reactions?: boolean;
  media?: boolean;
  textChunkLimit?: number;
};

export type ChannelPolicyHooks = {
  formatAllowFrom?: (allowFrom: string[]) => string[];
  resolveChatType?: (message: InboundMessage) => ChannelChatType;
};

export type ChannelDock = {
  id: ChannelId;
  capabilities: ChannelCapabilities;
  policies?: ChannelPolicyHooks;
};

const DEFAULT_CAPABILITIES: Record<string, ChannelCapabilities> = {
  telegram: { chatTypes: ["dm", "group", "thread"], threads: true, textChunkLimit: 4000 },
  discord: { chatTypes: ["dm", "group", "thread"], threads: true, textChunkLimit: 2000 },
  whatsapp: { chatTypes: ["dm", "group"], polls: true, reactions: true, media: true, textChunkLimit: 4000 }
};

export const CHANNEL_DOCKS: Record<string, ChannelDock> = {
  telegram: {
    id: "telegram",
    capabilities: DEFAULT_CAPABILITIES.telegram
  },
  discord: {
    id: "discord",
    capabilities: DEFAULT_CAPABILITIES.discord
  },
  whatsapp: {
    id: "whatsapp",
    capabilities: DEFAULT_CAPABILITIES.whatsapp
  }
};

export function getChannelDock(channelId: ChannelId): ChannelDock | undefined {
  return CHANNEL_DOCKS[String(channelId)];
}

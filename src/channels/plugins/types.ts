import type { ChannelId, MsgContext, OutboundMessage } from "../types";

export type OutboundDelivery = {
  channelId: ChannelId;
  messageId?: string;
  raw?: unknown;
};

export type ChannelOutboundAdapter = {
  id: ChannelId;
  buildPayload?: (message: OutboundMessage) => unknown;
  sendPayload?: (message: OutboundMessage) => Promise<OutboundDelivery>;
};

export type ChannelMentionAdapter = {
  stripPatterns?: (message: MsgContext) => string[];
  requireMentionByDefault?: boolean;
};

export type ChannelActionAdapter = {
  id: ChannelId;
  listActions?: () => string[];
  handleAction?: (action: string, message: MsgContext) => Promise<void>;
};

export type ChannelPlugin = {
  outbound?: ChannelOutboundAdapter;
  mentions?: ChannelMentionAdapter;
  actions?: ChannelActionAdapter;
};

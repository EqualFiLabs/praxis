export type ChannelId = "telegram" | "discord" | "whatsapp" | string;

export type ChannelMetadata = Record<string, unknown>;

export type ChatType = "dm" | "group" | "thread";

export interface InboundMessage {
  channelId: ChannelId;
  userId: string;
  threadId?: string;
  timestamp: string;
  content: string;
  metadata?: ChannelMetadata;
}

export interface MsgContext extends InboundMessage {
  chatType: ChatType;
  sessionKey: string;
  raw?: unknown;
}

export interface OutboundMessage {
  channelId: ChannelId;
  userId?: string;
  threadId?: string;
  timestamp?: string;
  content: string;
  metadata?: ChannelMetadata;
}

export type ChannelEventType =
  | "message"
  | "delivery"
  | "error"
  | "connected"
  | "disconnected";

export interface ChannelEvent {
  type: ChannelEventType;
  channelId: ChannelId;
  timestamp: string;
  details?: ChannelMetadata;
}

export type InboundMessageHandler = (message: MsgContext) => void | Promise<void>;

export interface ChannelClient {
  id: ChannelId;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(message: OutboundMessage): Promise<void>;
  onMessage?(handler: InboundMessageHandler): void;
}

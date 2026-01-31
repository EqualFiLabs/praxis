import type { ChannelsConfig } from "../types/config";
import type {
  ChannelClient,
  InboundMessage,
  InboundMessageHandler,
  MsgContext,
  OutboundMessage
} from "./types";
import { applyInboundPolicy } from "./dock";
import { resolveSecretFromEnv } from "../utils/secrets";
import { discordOutbound } from "./plugins/outbound/discord";

export type DiscordInbound = {
  senderId: string;
  channelId: string;
  text: string;
  threadId?: string;
  isGroup?: boolean;
};

export type DiscordGatewayMessage = {
  op: number;
  d?: any;
  s?: number;
  t?: string;
};

export type DiscordMessageCreate = {
  id: string;
  channel_id: string;
  guild_id?: string;
  content: string;
  author?: { id: string; bot?: boolean };
  thread?: { id: string };
};

export function normalizeDiscordInbound(
  cfg: ChannelsConfig["discord"],
  inbound: DiscordInbound
): MsgContext | null {
  if (!cfg?.enabled) return null;
  const message: InboundMessage = {
    channelId: "discord",
    userId: inbound.senderId,
    threadId: inbound.threadId,
    timestamp: new Date().toISOString(),
    content: inbound.text,
    metadata: {
      channelId: inbound.channelId,
      isGroup: inbound.isGroup ?? false
    }
  };
  return applyInboundPolicy("discord", message, {
    allowFrom: cfg.allowFrom,
    mentionPolicy: {
      requireInGroups: cfg.requireMentionInGroups,
      patterns: cfg.mentionPatterns
    }
  });
}

const DEFAULT_API_BASE = "https://discord.com/api/v10";
const DEFAULT_GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

export class DiscordClient implements ChannelClient {
  public readonly id = "discord";
  private onMessageHandler?: InboundMessageHandler;
  private socket?: any;
  private seq: number | null = null;
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private token?: string;
  private stopped = false;

  constructor(private readonly config: ChannelsConfig["discord"]) {}

  onMessage(handler: InboundMessageHandler): void {
    this.onMessageHandler = handler;
  }

  async start(): Promise<void> {
    if (!this.config?.enabled) return;
    this.stopped = false;
    this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  async send(message: OutboundMessage): Promise<void> {
    if (!this.config?.enabled) return;
    const payload = discordOutbound.buildPayload?.(message) as {
      channel_id: string;
      content: string;
    };
    if (!payload?.channel_id) {
      throw new Error("Discord outbound requires channel_id");
    }
    await this.sendMessage(payload.channel_id, payload.content);
  }

  private connect(): void {
    const WebSocketImpl = (globalThis as any).WebSocket;
    if (!WebSocketImpl) {
      throw new Error("WebSocket is not available in this runtime");
    }
    const socket = new WebSocketImpl(DEFAULT_GATEWAY_URL);
    this.socket = socket;
    socket.onopen = () => {
      this.identify();
    };
    socket.onmessage = (event: { data: string }) => {
      this.handleGatewayMessage(event.data);
    };
    socket.onclose = () => {
      this.scheduleReconnect();
    };
    socket.onerror = () => {
      this.scheduleReconnect();
    };
  }

  private handleGatewayMessage(raw: string): void {
    const message = JSON.parse(raw) as DiscordGatewayMessage;
    if (message.s != null) {
      this.seq = message.s;
    }
    switch (message.op) {
      case 10: {
        const interval = message.d?.heartbeat_interval ?? 45000;
        this.startHeartbeat(interval);
        break;
      }
      case 11:
        break;
      case 0:
        if (message.t === "MESSAGE_CREATE") {
          void this.handleMessageCreate(message.d as DiscordMessageCreate);
        }
        break;
      default:
        break;
    }
  }

  private async handleMessageCreate(event: DiscordMessageCreate): Promise<void> {
    if (event.author?.bot) return;
    const inbound: DiscordInbound = {
      senderId: event.author?.id ?? "",
      channelId: event.channel_id,
      text: event.content,
      threadId: event.thread?.id,
      isGroup: Boolean(event.guild_id)
    };
    const normalized = normalizeDiscordInbound(this.config, inbound);
    if (!normalized || !this.onMessageHandler) return;
    await this.onMessageHandler(normalized);
  }

  private identify(): void {
    const token = this.getToken();
    const intents = (1 << 9) | (1 << 12) | (1 << 15);
    const payload = {
      op: 2,
      d: {
        token,
        intents,
        properties: {
          os: "linux",
          browser: "praxis",
          device: "praxis"
        }
      }
    };
    this.socket?.send(JSON.stringify(payload));
  }

  private startHeartbeat(interval: number): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.socket?.send(JSON.stringify({ op: 1, d: this.seq }));
    }, interval);
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, 3000);
  }

  private async sendMessage(channelId: string, content: string): Promise<void> {
    const token = this.getToken();
    const apiBase = this.config?.apiBaseUrl ?? DEFAULT_API_BASE;
    const url = `${apiBase}/channels/${channelId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bot ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ content })
    });
    if (!response.ok) {
      throw new Error(`Discord send failed: ${response.status}`);
    }
  }

  private getToken(): string {
    if (!this.token) {
      if (!this.config?.botTokenEnv) {
        throw new Error("Discord bot token env not configured");
      }
      this.token = resolveSecretFromEnv(this.config.botTokenEnv, "discord bot token");
    }
    return this.token;
  }
}

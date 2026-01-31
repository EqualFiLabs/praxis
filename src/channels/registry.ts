import type {
  ChannelClient,
  ChannelId,
  InboundMessageHandler,
  OutboundMessage,
} from "./types";
import { CHANNEL_DOCKS } from "./dock";
import type { ChannelCapabilities } from "./dock";

export type ChannelMeta = {
  id: ChannelId;
  label: string;
  docsPath: string;
  capabilities: ChannelCapabilities;
};

export const CHANNEL_METADATA: Record<string, ChannelMeta> = {
  telegram: {
    id: "telegram",
    label: "Telegram",
    docsPath: "/channels/telegram",
    capabilities: CHANNEL_DOCKS.telegram.capabilities
  },
  discord: {
    id: "discord",
    label: "Discord",
    docsPath: "/channels/discord",
    capabilities: CHANNEL_DOCKS.discord.capabilities
  },
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp",
    docsPath: "/channels/whatsapp",
    capabilities: CHANNEL_DOCKS.whatsapp.capabilities
  }
};

export function listChannelMetadata(): ChannelMeta[] {
  return Object.values(CHANNEL_METADATA);
}

export function getChannelMetadata(channelId: ChannelId): ChannelMeta | undefined {
  return CHANNEL_METADATA[String(channelId)];
}

export class ChannelRegistry {
  private clients = new Map<ChannelId, ChannelClient>();

  register(client: ChannelClient): void {
    if (this.clients.has(client.id)) {
      throw new Error(`Channel client already registered: ${client.id}`);
    }
    this.clients.set(client.id, client);
  }

  get(channelId: ChannelId): ChannelClient | undefined {
    return this.clients.get(channelId);
  }

  list(): ChannelClient[] {
    return Array.from(this.clients.values());
  }

  onMessage(handler: InboundMessageHandler): void {
    for (const client of this.clients.values()) {
      client.onMessage?.(handler);
    }
  }

  async startAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.start();
    }
  }

  async stopAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.stop();
    }
  }

  async send(message: OutboundMessage): Promise<void> {
    const client = this.clients.get(message.channelId);
    if (!client) {
      throw new Error(`No channel client registered for ${message.channelId}`);
    }
    await client.send(message);
  }
}

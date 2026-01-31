import type {
  ChannelClient,
  ChannelId,
  InboundMessageHandler,
  OutboundMessage,
} from "./types";

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

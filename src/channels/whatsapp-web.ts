import type { ChannelClient, InboundMessageHandler, OutboundMessage } from "./types";

export class WhatsAppWebClient implements ChannelClient {
  public readonly id = "whatsapp";
  private onMessageHandler?: InboundMessageHandler;

  constructor(private readonly sessionDir: string) {}

  onMessage(handler: InboundMessageHandler): void {
    this.onMessageHandler = handler;
  }

  async start(): Promise<void> {
    if (!this.sessionDir) {
      throw new Error("WhatsApp web client requires sessionDir");
    }
  }

  async stop(): Promise<void> {
    return;
  }

  async send(_message: OutboundMessage): Promise<void> {
    throw new Error("WhatsApp web client not implemented (QR login + send)");
  }
}

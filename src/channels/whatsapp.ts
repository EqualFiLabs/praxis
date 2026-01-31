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
import { verifyHmacSignature } from "./webhooks";
import { whatsappOutbound } from "./plugins/outbound/whatsapp";

export type WhatsappInbound = {
  senderId: string;
  chatId: string;
  text: string;
  threadId?: string;
  isGroup?: boolean;
};

export function normalizeWhatsappInbound(
  cfg: ChannelsConfig["whatsapp"],
  inbound: WhatsappInbound
): MsgContext | null {
  if (!cfg?.enabled) return null;
  const message: InboundMessage = {
    channelId: "whatsapp",
    userId: inbound.senderId,
    threadId: inbound.threadId,
    timestamp: new Date().toISOString(),
    content: inbound.text,
    metadata: {
      chatId: inbound.chatId,
      isGroup: inbound.isGroup ?? false
    }
  };
  return applyInboundPolicy("whatsapp", message, {
    allowFrom: cfg.allowFrom
  });
}

export type WhatsAppWebhookMessage = {
  from: string;
  id: string;
  timestamp: string;
  text?: { body?: string };
};

export type WhatsAppWebhookEntry = {
  changes?: Array<{
    value?: {
      messages?: WhatsAppWebhookMessage[];
      metadata?: { phone_number_id?: string; display_phone_number?: string };
    };
  }>;
};

export type WhatsAppWebhookPayload = {
  entry?: WhatsAppWebhookEntry[];
};

export type WhatsAppSendPayload = {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: { body: string };
};

const DEFAULT_API_BASE_URL = "https://graph.facebook.com/v19.0";

export class WhatsAppCloudClient implements ChannelClient {
  public readonly id = "whatsapp";
  private onMessageHandler?: InboundMessageHandler;
  private token?: string;

  constructor(private readonly config: ChannelsConfig["whatsapp"]) {}

  onMessage(handler: InboundMessageHandler): void {
    this.onMessageHandler = handler;
  }

  async start(): Promise<void> {
    if (!this.config?.enabled) return;
  }

  async stop(): Promise<void> {
    return;
  }

  async send(message: OutboundMessage): Promise<void> {
    if (!this.config?.enabled) return;
    const payload = whatsappOutbound.buildPayload?.(message) as { to: string; text: string };
    if (!payload?.to) {
      throw new Error("WhatsApp outbound requires target");
    }
    await this.sendMessage(payload.to, payload.text);
  }

  async handleWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    if (!this.config?.enabled) return;
    const entries = payload.entry ?? [];
    for (const entry of entries) {
      const messages = entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? [];
      for (const msg of messages) {
        const inbound: WhatsappInbound = {
          senderId: msg.from,
          chatId: msg.from,
          text: msg.text?.body ?? "",
          isGroup: false
        };
        const normalized = normalizeWhatsappInbound(this.config, inbound);
        if (!normalized || !this.onMessageHandler) continue;
        await this.onMessageHandler(normalized);
      }
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string | null | undefined): boolean {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret) {
      return true;
    }
    return verifyHmacSignature(rawBody, secret, signature, {
      algorithm: "sha256",
      encoding: "hex",
      signaturePrefix: "sha256="
    });
  }

  private async sendMessage(to: string, text: string): Promise<void> {
    const token = this.getToken();
    const apiBase = this.config?.apiBaseUrl ?? DEFAULT_API_BASE_URL;
    const phoneId = this.config?.sessionDir;
    if (!phoneId) {
      throw new Error("WhatsApp cloud requires sessionDir to be phone_number_id");
    }
    const url = `${apiBase}/${phoneId}/messages`;
    const payload: WhatsAppSendPayload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text }
    };
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`WhatsApp send failed: ${response.status}`);
    }
  }

  private getToken(): string {
    if (!this.token) {
      this.token = resolveSecretFromEnv("WHATSAPP_ACCESS_TOKEN", "whatsapp access token");
    }
    return this.token;
  }
}

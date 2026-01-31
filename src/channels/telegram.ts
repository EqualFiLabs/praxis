import type { ChannelsConfig } from "../types/config";
import type { ChannelClient, InboundMessage, InboundMessageHandler, OutboundMessage } from "./types";
import { resolveSecretFromEnv } from "../utils/secrets";
import { buildSessionKey, isAllowedSender } from "./session-key";

export type TelegramInbound = {
  senderId: string;
  chatId: string;
  text: string;
  threadId?: string;
  isGroup?: boolean;
  timestamp?: string;
};

export type TelegramMessage = {
  message_id: number;
  date: number;
  text?: string;
  from?: { id: number | string };
  chat: { id: number | string; type: string };
  message_thread_id?: number;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
};

export type TelegramSendPayload = {
  chat_id: string;
  text: string;
  message_thread_id?: number;
};

const DEFAULT_API_BASE_URL = "https://api.telegram.org";
const DEFAULT_POLL_INTERVAL_MS = 1500;

export function extractTelegramInbound(update: TelegramUpdate): TelegramInbound | null {
  const message = update.message ?? update.edited_message ?? update.channel_post;
  if (!message || !message.text) return null;
  const senderId = message.from?.id ? String(message.from.id) : "";
  if (!senderId) return null;
  const chatId = String(message.chat.id);
  const isGroup = message.chat.type !== "private";
  const threadId = message.message_thread_id ? String(message.message_thread_id) : undefined;
  const timestamp = new Date(message.date * 1000).toISOString();
  return {
    senderId,
    chatId,
    text: message.text,
    threadId,
    isGroup,
    timestamp
  };
}

export function normalizeTelegramInbound(
  cfg: ChannelsConfig["telegram"],
  inbound: TelegramInbound
): InboundMessage | null {
  if (!cfg?.enabled) return null;
  if (!isAllowedSender(cfg.allowFrom, inbound.senderId)) return null;
  const sessionKey = buildSessionKey({
    channel: "telegram",
    senderId: inbound.senderId,
    groupId: inbound.isGroup ? inbound.chatId : undefined,
    threadId: inbound.threadId
  });
  return {
    channelId: "telegram",
    userId: inbound.senderId,
    threadId: inbound.threadId,
    timestamp: inbound.timestamp ?? new Date().toISOString(),
    content: inbound.text,
    metadata: {
      sessionKey,
      chatId: inbound.chatId,
      isGroup: inbound.isGroup ?? false
    }
  };
}

export function buildTelegramSendPayload(message: OutboundMessage): TelegramSendPayload {
  const chatId =
    (message.metadata?.chatId as string | undefined) ??
    message.userId ??
    (message.metadata?.to as string | undefined);
  if (!chatId) {
    throw new Error("Telegram send requires chatId or userId");
  }
  const payload: TelegramSendPayload = {
    chat_id: chatId,
    text: message.content
  };
  if (message.threadId) {
    const numericThread = Number(message.threadId);
    payload.message_thread_id = Number.isFinite(numericThread)
      ? numericThread
      : undefined;
  }
  return payload;
}

export class TelegramClient implements ChannelClient {
  public readonly id = "telegram";
  private onMessageHandler?: InboundMessageHandler;
  private abortController?: AbortController;
  private pollPromise?: Promise<void>;
  private offset = 0;
  private botToken?: string;

  constructor(
    private readonly config: ChannelsConfig["telegram"],
    private readonly options: { pollIntervalMs?: number } = {}
  ) {}

  onMessage(handler: InboundMessageHandler): void {
    this.onMessageHandler = handler;
  }

  async start(): Promise<void> {
    if (!this.config?.enabled) return;
    if (this.config.polling) {
      this.abortController = new AbortController();
      this.pollPromise = this.pollLoop(this.abortController.signal);
    }
  }

  async stop(): Promise<void> {
    this.abortController?.abort();
    if (this.pollPromise) {
      await this.pollPromise.catch(() => undefined);
    }
  }

  async send(message: OutboundMessage): Promise<void> {
    if (!this.config?.enabled) return;
    const payload = buildTelegramSendPayload(message);
    const maxAttempts = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        await this.sendMessage(payload);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts - 1) {
          const delay = 250 * Math.pow(2, attempt);
          await sleep(delay);
        }
      }
    }
    throw lastError;
  }

  private async pollLoop(signal: AbortSignal): Promise<void> {
    const interval = this.options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    while (!signal.aborted) {
      try {
        const updates = await this.getUpdates(this.offset, signal);
        for (const update of updates) {
          this.offset = Math.max(this.offset, update.update_id + 1);
          const inbound = extractTelegramInbound(update);
          if (!inbound) continue;
          const normalized = normalizeTelegramInbound(this.config, inbound);
          if (!normalized || !this.onMessageHandler) continue;
          await this.onMessageHandler(normalized);
        }
      } catch {
        // swallow polling errors and retry
      }
      await sleep(interval, signal);
    }
  }

  private async getUpdates(offset: number, signal: AbortSignal): Promise<TelegramUpdate[]> {
    const url = this.buildApiUrl("getUpdates");
    url.searchParams.set("timeout", "30");
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Telegram getUpdates failed: ${response.status}`);
    }
    const data = (await response.json()) as { ok: boolean; result?: TelegramUpdate[] };
    if (!data.ok) {
      throw new Error("Telegram getUpdates returned ok=false");
    }
    return data.result ?? [];
  }

  private async sendMessage(payload: TelegramSendPayload): Promise<void> {
    const url = this.buildApiUrl("sendMessage");
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`Telegram sendMessage failed: ${response.status}`);
    }
    const data = (await response.json()) as { ok: boolean };
    if (!data.ok) {
      throw new Error("Telegram sendMessage returned ok=false");
    }
  }

  private buildApiUrl(method: string): URL {
    const botToken = this.getBotToken();
    const baseUrl = this.config?.apiBaseUrl ?? DEFAULT_API_BASE_URL;
    return new URL(`${baseUrl}/bot${botToken}/${method}`);
  }

  private getBotToken(): string {
    if (!this.botToken) {
      if (!this.config?.botTokenEnv) {
        throw new Error("Telegram bot token env not configured");
      }
      this.botToken = resolveSecretFromEnv(this.config.botTokenEnv, "telegram bot token");
    }
    return this.botToken;
  }
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true }
      );
    }
  });
}

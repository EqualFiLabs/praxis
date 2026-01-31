import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { ChannelsConfig } from "../types/config";
import type { InboundMessage } from "../channels/types";
import { verifySecretToken, ackResponse } from "../channels/webhooks";
import { extractTelegramInbound, normalizeTelegramInbound, TelegramUpdate } from "../channels/telegram";
import { resolveSecretFromEnv } from "../utils/secrets";

export type TelegramWebhookOptions = {
  config: ChannelsConfig["telegram"];
  onMessage: (message: InboundMessage) => void | Promise<void>;
  port?: number;
  path?: string;
};

export async function runTelegramWebhookServer(
  options: TelegramWebhookOptions
): Promise<ReturnType<typeof createServer>> {
  if (!options.config?.enabled) {
    throw new Error("Telegram webhook cannot start: telegram channel disabled");
  }
  const port = options.port ?? 8080;
  const path = options.path ?? "/telegram/webhook";
  const expectedToken = resolveSecretFromEnv(
    options.config.botTokenEnv,
    "telegram bot token"
  );

  const server = createServer(async (req, res) => {
    if (!req.url || req.method !== "POST" || !req.url.startsWith(path)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }

    const provided = req.headers["x-telegram-bot-api-secret-token"];
    const providedToken = Array.isArray(provided) ? provided[0] : provided ?? null;
    if (!verifySecretToken(expectedToken, providedToken)) {
      res.writeHead(401, { "content-type": "text/plain" });
      res.end("Unauthorized");
      return;
    }

    const body = await readBody(req);
    let update: TelegramUpdate | null = null;
    try {
      update = JSON.parse(body) as TelegramUpdate;
    } catch {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("Invalid JSON");
      return;
    }

    const ack = ackResponse();
    res.writeHead(ack.statusCode, ack.headers);
    res.end(ack.body);

    void handleUpdate(options, update);
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  return server;
}

async function handleUpdate(options: TelegramWebhookOptions, update: TelegramUpdate): Promise<void> {
  const inbound = extractTelegramInbound(update);
  if (!inbound) return;
  const normalized = normalizeTelegramInbound(options.config, inbound);
  if (!normalized) return;
  await options.onMessage(normalized);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

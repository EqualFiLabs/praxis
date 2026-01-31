import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { ChannelsConfig } from "../types/config";
import { WhatsAppCloudClient, WhatsAppWebhookPayload } from "../channels/whatsapp";
import { verifyHmacSignature } from "../channels/webhooks";

export type WhatsAppWebhookOptions = {
  config: ChannelsConfig["whatsapp"];
  port?: number;
  path?: string;
};

export async function runWhatsAppWebhookServer(
  options: WhatsAppWebhookOptions
): Promise<ReturnType<typeof createServer>> {
  if (!options.config?.enabled) {
    throw new Error("WhatsApp webhook cannot start: channel disabled");
  }
  const port = options.port ?? 8082;
  const path = options.path ?? "/whatsapp/webhook";
  const client = new WhatsAppCloudClient(options.config);
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  const server = createServer(async (req, res) => {
    if (!req.url || !req.method) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }

    if (req.method === "GET" && req.url.startsWith(path)) {
      const url = new URL(req.url, "http://localhost");
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token) {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end(challenge ?? "");
        return;
      }
      res.writeHead(403, { "content-type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    if (req.method !== "POST" || !req.url.startsWith(path)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }

    const body = await readBody(req);
    const signature = headerValue(req.headers["x-hub-signature-256"]);
    if (appSecret && signature) {
      const valid = verifyHmacSignature(body, appSecret, signature, {
        algorithm: "sha256",
        encoding: "hex",
        signaturePrefix: "sha256="
      });
      if (!valid) {
        res.writeHead(401, { "content-type": "text/plain" });
        res.end("Invalid signature");
        return;
      }
    }

    res.writeHead(200, { "content-type": "text/plain" });
    res.end("OK");

    const payload = JSON.parse(body) as WhatsAppWebhookPayload;
    await client.handleWebhook(payload);
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  return server;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function headerValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

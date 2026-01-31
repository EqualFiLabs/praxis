import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { verify } from "node:crypto";
import type { ChannelsConfig } from "../types/config";
import { resolveSecretFromEnv } from "../utils/secrets";

export type DiscordInteractionsOptions = {
  config: ChannelsConfig["discord"];
  port?: number;
  path?: string;
};

export async function runDiscordInteractionsServer(
  options: DiscordInteractionsOptions
): Promise<ReturnType<typeof createServer>> {
  if (!options.config?.enabled) {
    throw new Error("Discord interactions cannot start: discord channel disabled");
  }
  if (!options.config.publicKeyEnv) {
    throw new Error("Discord interactions require publicKeyEnv");
  }
  const port = options.port ?? 8081;
  const path = options.path ?? "/discord/interactions";
  const publicKeyHex = resolveSecretFromEnv(options.config.publicKeyEnv, "discord public key");
  const publicKey = Buffer.from(publicKeyHex, "hex");

  const server = createServer(async (req, res) => {
    if (!req.url || req.method !== "POST" || !req.url.startsWith(path)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }

    const signature = headerValue(req.headers["x-signature-ed25519"]);
    const timestamp = headerValue(req.headers["x-signature-timestamp"]);
    const body = await readBody(req);
    if (!signature || !timestamp) {
      res.writeHead(401, { "content-type": "text/plain" });
      res.end("Missing signature headers");
      return;
    }

    const isValid = verifyDiscordSignature(publicKey, timestamp, body, signature);
    if (!isValid) {
      res.writeHead(401, { "content-type": "text/plain" });
      res.end("Invalid signature");
      return;
    }

    const payload = JSON.parse(body) as { type?: number };
    if (payload.type === 1) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: 1 }));
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ type: 5 }));
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  return server;
}

function verifyDiscordSignature(
  publicKey: Buffer,
  timestamp: string,
  body: string,
  signatureHex: string
): boolean {
  const message = Buffer.from(timestamp + body);
  const signature = Buffer.from(signatureHex, "hex");
  try {
    return verify(null, message, publicKey, signature);
  } catch {
    return false;
  }
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

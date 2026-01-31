import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import type { ChannelsConfig } from "../types/config";
import { WhatsAppCloudClient, WhatsAppWebhookPayload } from "../channels/whatsapp";
import { verifyHmacSignature } from "../channels/webhooks";
import type { MsgContext } from "../channels/types";
import { loadConfig } from "../config/loader";
import { normalizeConfig } from "../config/normalized";
import { createAgentLoop } from "../agent/loop";
import { loadMemory, saveMemory, appendDecision } from "../memory/store";
import { loadConstraints } from "../constraints/checker";
import { append as appendTranscript } from "../session/transcript";
import { selectProviderWithProbe } from "../inference/manager";
import { planWithInference } from "../planning/plan";
import { createChainRuntime } from "../chain/runtime";

export type WhatsAppWebhookOptions = {
  config: ChannelsConfig["whatsapp"];
  onMessage?: (message: MsgContext) => void | Promise<void>;
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
  if (options.onMessage) {
    client.onMessage(options.onMessage);
  }
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

type WebhookArgs = {
  agentId: string;
  port?: number;
  path?: string;
};

function usage(): string {
  return "Usage: praxis-whatsapp-webhook --agent <id> [--port 8082] [--path /whatsapp/webhook]";
}

function printUsage(): void {
  process.stdout.write(`${usage()}\n`);
}

function parseArgs(argv: string[]): WebhookArgs {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }
  const agentIndex = args.indexOf("--agent");
  if (agentIndex === -1) {
    throw new Error(usage());
  }
  const agentId = args[agentIndex + 1];
  if (!agentId) {
    throw new Error("agentId is required");
  }
  const portIndex = args.indexOf("--port");
  const pathIndex = args.indexOf("--path");
  const port = portIndex !== -1 ? Number(args[portIndex + 1]) : undefined;
  const path = pathIndex !== -1 ? args[pathIndex + 1] : undefined;
  return { agentId, port, path };
}

function redactSecrets(text: string): string {
  const envPattern = /(OPENAI|ANTHROPIC|GOOGLE|OLLAMA|PRIVATE)_?API?_?KEY/gi;
  return text.replace(envPattern, "REDACTED");
}

async function main() {
  const { agentId, port, path } = parseArgs(process.argv);
  const config = normalizeConfig(await loadConfig(agentId));
  if (!config.channels?.whatsapp) {
    throw new Error("whatsapp channel not configured");
  }
  if (config.channels.whatsapp.provider && config.channels.whatsapp.provider !== "cloud") {
    throw new Error("whatsapp webhook requires provider=cloud");
  }

  await selectProviderWithProbe({ inference: config.inference, providers: config.providers });
  const chainRuntime = createChainRuntime({ config });

  const loop = createAgentLoop({
    agentId,
    tbaAddress: config.chain.tbaAddress,
    loadMemory,
    saveMemory,
    loadConstraints,
    inferPlan: async (context, input) => {
      const result = await planWithInference({
        context,
        input,
        inference: { inference: config.inference, providers: config.providers }
      });
      return result.plan;
    },
    allowedSelectors: chainRuntime.allowedSelectors,
    hasGenericExec: chainRuntime.hasGenericExec,
    executeAction: chainRuntime.executeAction,
    appendTranscript: async (entry) => {
      await appendTranscript(agentId, "main", {
        ...entry,
        text: redactSecrets(entry.text)
      });
    },
    appendDecision: async (decision) => {
      await appendDecision(agentId, decision);
    }
  });

  await runWhatsAppWebhookServer({
    config: config.channels.whatsapp,
    onMessage: async (message) => {
      await loop.intake({
        type: "prompt",
        text: message.content,
        sessionId: message.sessionKey
      });
    },
    port,
    path
  });

  process.stdout.write(
    `WhatsApp webhook listening on ${path ?? "/whatsapp/webhook"} (port ${port ?? 8082})\n`
  );
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

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}

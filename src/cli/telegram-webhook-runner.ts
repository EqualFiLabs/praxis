import { loadConfig } from "../config/loader";
import { normalizeConfig } from "../config/normalized";
import { createAgentLoop } from "../agent/loop";
import { loadMemory, saveMemory, appendDecision } from "../memory/store";
import { loadConstraints } from "../constraints/checker";
import { selectProviderWithProbe } from "../inference/manager";
import { append as appendTranscript } from "../session/transcript";
import { runTelegramWebhookServer } from "./telegram-webhook";

type WebhookArgs = {
  agentId: string;
  port?: number;
  path?: string;
};

function parseArgs(argv: string[]): WebhookArgs {
  const args = argv.slice(2);
  const agentIndex = args.indexOf("--agent");
  if (agentIndex === -1) {
    throw new Error("Usage: praxis-telegram-webhook --agent <id> [--port 8080] [--path /telegram/webhook]");
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
  if (!config.channels?.telegram) {
    throw new Error("telegram channel not configured");
  }

  await selectProviderWithProbe({ inference: config.inference, providers: config.providers });

  const loop = createAgentLoop({
    agentId,
    tbaAddress: config.chain.tbaAddress,
    loadMemory,
    saveMemory,
    loadConstraints,
    inferPlan: async (_context, _input) => {
      return { actions: [], reasoning: "" };
    },
    allowedSelectors: async () => [],
    hasGenericExec: async () => false,
    executeAction: async () => ({ error: "execution not configured" }),
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

  await runTelegramWebhookServer({
    config: config.channels.telegram,
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
    `Telegram webhook listening on ${path ?? "/telegram/webhook"} (port ${port ?? 8080})\n`
  );
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

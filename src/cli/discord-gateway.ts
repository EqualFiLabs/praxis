import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadConfig } from "../config/loader";
import { normalizeConfig } from "../config/normalized";
import { selectProviderWithProbe } from "../inference/manager";
import { createRuntime } from "./runtime";
import { ChannelRegistry } from "../channels/registry";
import { DiscordClient } from "../channels/discord";
import { appendChannelEvent } from "../channels/observability";

type GatewayArgs = {
  agentId: string;
  intervalMs?: number;
};

function usage(): string {
  return "Usage: praxis-discord-gateway --agent <id> [--interval 60000]";
}

function printUsage(): void {
  process.stdout.write(`${usage()}\n`);
}

function parseArgs(argv: string[]): GatewayArgs {
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
  const intervalIndex = args.indexOf("--interval");
  const intervalMs = intervalIndex !== -1 ? Number(args[intervalIndex + 1]) : undefined;
  return { agentId, intervalMs };
}

async function main() {
  const { agentId, intervalMs } = parseArgs(process.argv);
  const config = normalizeConfig(await loadConfig(agentId));
  if (!config.channels?.discord) {
    throw new Error("discord channel not configured");
  }

  await selectProviderWithProbe({ inference: config.inference, providers: config.providers });

  const registry = new ChannelRegistry();
  registry.register(new DiscordClient(config.channels.discord));

  const runtime = await createRuntime({
    agentId,
    config,
    registry,
    skipAutoRegister: true,
    schedulerIntervalMs: intervalMs,
    onEvent: (event) => {
      void appendChannelEvent(agentId, event);
    }
  });

  await runtime.start();
  process.stdout.write("Discord gateway running\n");

  process.on("SIGINT", async () => {
    await runtime.stop();
    process.exit(0);
  });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}

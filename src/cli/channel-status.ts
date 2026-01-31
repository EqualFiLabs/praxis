import { loadConfig } from "../config/loader";
import { normalizeConfig } from "../config/normalized";
import { probeChannels } from "../channels/status";

function parseArgs(argv: string[]): string {
  const args = argv.slice(2);
  const agentIndex = args.indexOf("--agent");
  if (agentIndex === -1) {
    throw new Error("Usage: praxis-channel-status --agent <id>");
  }
  const agentId = args[agentIndex + 1];
  if (!agentId) {
    throw new Error("agentId is required");
  }
  return agentId;
}

async function main() {
  const agentId = parseArgs(process.argv);
  const config = normalizeConfig(await loadConfig(agentId));
  const status = probeChannels(config);
  process.stdout.write(JSON.stringify(status, null, 2));
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

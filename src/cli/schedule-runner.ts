import { loadConfig } from "../config/loader";
import { normalizeConfig } from "../config/normalized";
import { startScheduler, type ScheduledJob } from "../scheduler";

function parseArgs(argv: string[]): { agentId: string; intervalMs?: number } {
  const args = argv.slice(2);
  const agentIndex = args.indexOf("--agent");
  if (agentIndex === -1) {
    throw new Error("Usage: praxis schedule --agent <id> [--interval 60000]");
  }
  const agentId = args[agentIndex + 1];
  const intervalIndex = args.indexOf("--interval");
  const intervalMs = intervalIndex !== -1 ? Number(args[intervalIndex + 1]) : undefined;
  if (!agentId) {
    throw new Error("agentId is required");
  }
  return { agentId, intervalMs };
}

async function main() {
  const { agentId, intervalMs } = parseArgs(process.argv);
  normalizeConfig(await loadConfig(agentId));

  const runner = startScheduler(
    agentId,
    async (job: ScheduledJob) => {
      process.stdout.write(`job ${job.id} executed\n`);
    },
    intervalMs
  );

  process.stdout.write("scheduler running\n");
  process.on("SIGINT", () => {
    runner.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

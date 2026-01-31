import { loadConfig } from "../config/loader";
import { normalizeConfig } from "../config/normalized";
import { createAgentLoop } from "../agent/loop";
import { loadMemory, saveMemory, appendDecision } from "../memory/store";
import { loadConstraints } from "../constraints/checker";
import { selectProviderWithProbe } from "../inference/manager";
import { planWithInference } from "../planning/plan";
import { append as appendTranscript } from "../session/transcript";
import { createTelemetryLogger } from "../telemetry/logger";
import { createChainRuntime } from "../chain/runtime";

function parseArgs(argv: string[]): { agentId: string; input: string } {
  const args = argv.slice(2);
  const agentIndex = args.indexOf("--agent");
  const inputIndex = args.indexOf("--input");
  if (agentIndex === -1 || inputIndex === -1) {
    throw new Error("Usage: praxis --agent <id> --input <text>");
  }
  const agentId = args[agentIndex + 1];
  const input = args[inputIndex + 1];
  if (!agentId || !input) {
    throw new Error("agentId and input are required");
  }
  return { agentId, input };
}

function redactSecrets(text: string): string {
  const envPattern = /(OPENAI|ANTHROPIC|GOOGLE|OLLAMA|PRIVATE)_?API?_?KEY/gi;
  return text.replace(envPattern, "REDACTED");
}

async function main() {
  const { agentId, input } = parseArgs(process.argv);
  const config = normalizeConfig(await loadConfig(agentId));
  // Startup validation: probe inference providers and fail fast.
  await selectProviderWithProbe({ inference: config.inference, providers: config.providers });
  const chainRuntime = createChainRuntime({ config });

  const loop = createAgentLoop({
    agentId,
    tbaAddress: config.chain.tbaAddress,
    loadMemory,
    saveMemory,
    loadConstraints,
    inferPlan: async (context, agentInput) => {
      const result = await planWithInference({
        context,
        input: agentInput,
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
    },
    telemetry: createTelemetryLogger(agentId)
  });

  const report = await loop.intake({ type: "prompt", text: input });
  process.stdout.write(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

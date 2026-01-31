import { fileURLToPath } from "node:url";
import path from "node:path";

import type { AgentLoop, AgentReport } from "../agent/loop";
import type { ChannelPlugin } from "../channels/plugins/types";
import type { ChannelEvent, OutboundMessage } from "../channels/types";
import type { NormalizedConfig } from "../config/normalized";
import type { ScheduledJob } from "../scheduler";

import { createAgentLoop } from "../agent/loop";
import { loadConfig } from "../config/loader";
import { normalizeConfig } from "../config/normalized";
import { loadMemory, saveMemory, appendDecision } from "../memory/store";
import { loadConstraints } from "../constraints/checker";
import { append as appendTranscript } from "../session/transcript";
import { createTelemetryLogger } from "../telemetry/logger";
import { selectProviderWithProbe } from "../inference/manager";
import { planWithInference } from "../planning/plan";
import { createChainRuntime } from "../chain/runtime";
import { ChannelRegistry } from "../channels/registry";
import { ChannelRuntimeManager } from "../channels/runtime";
import { TelegramClient } from "../channels/telegram";
import { DiscordClient } from "../channels/discord";
import { WhatsAppCloudClient } from "../channels/whatsapp";
import { WhatsAppWebClient } from "../channels/whatsapp-web";
import { telegramOutbound } from "../channels/plugins/outbound/telegram";
import { discordOutbound } from "../channels/plugins/outbound/discord";
import { whatsappOutbound } from "../channels/plugins/outbound/whatsapp";
import { appendChannelEvent } from "../channels/observability";
import { startScheduler, type JobHandler } from "../scheduler";

export type RuntimeInstance = {
  registry: ChannelRegistry;
  channelRuntime: ChannelRuntimeManager;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export type RuntimeDeps = {
  agentId: string;
  config: NormalizedConfig;
  registry?: ChannelRegistry;
  agentLoop?: AgentLoop;
  schedulerIntervalMs?: number;
  startSchedulerFn?: typeof startScheduler;
  plugins?: Record<string, ChannelPlugin>;
  onEvent?: (event: ChannelEvent) => void;
  skipAutoRegister?: boolean;
};

function redactSecrets(text: string): string {
  const envPattern = /(OPENAI|ANTHROPIC|GOOGLE|OLLAMA|PRIVATE)_?API?_?KEY/gi;
  return text.replace(envPattern, "REDACTED");
}

export async function createRuntime(deps: RuntimeDeps): Promise<RuntimeInstance> {
  const registry = deps.registry ?? new ChannelRegistry();
  if (!deps.skipAutoRegister && !deps.registry) {
    registerDefaultChannels(registry, deps.config);
  }

  const agentLoop =
    deps.agentLoop ??
    (() => {
      const chainRuntime = createChainRuntime({ config: deps.config });
      return createAgentLoop({
        agentId: deps.agentId,
        tbaAddress: deps.config.chain.tbaAddress,
        loadMemory,
        saveMemory,
        loadConstraints,
        inferPlan: async (context, input) => {
          const result = await planWithInference({
            context,
            input,
            inference: { inference: deps.config.inference, providers: deps.config.providers }
          });
          return result.plan;
        },
        allowedSelectors: chainRuntime.allowedSelectors,
        hasGenericExec: chainRuntime.hasGenericExec,
        executeAction: chainRuntime.executeAction,
        appendTranscript: async (entry) => {
          await appendTranscript(deps.agentId, "main", {
            ...entry,
            text: redactSecrets(entry.text)
          });
        },
        appendDecision: async (decision) => {
          await appendDecision(deps.agentId, decision);
        },
        telemetry: createTelemetryLogger(deps.agentId),
        getActionPolicy: () => deps.config.policies?.actions
      });
    })();

  const plugins =
    deps.plugins ??
    ({
      telegram: { outbound: telegramOutbound },
      discord: { outbound: discordOutbound },
      whatsapp: { outbound: whatsappOutbound }
    } satisfies Record<string, ChannelPlugin>);

  const enabledChannels: Record<string, boolean> = {
    telegram: deps.config.channels?.telegram?.enabled ?? false,
    discord: deps.config.channels?.discord?.enabled ?? false,
    whatsapp: deps.config.channels?.whatsapp?.enabled ?? false
  };

  const channelRuntime = new ChannelRuntimeManager({
    registry,
    agentLoop,
    plugins,
    enabledChannels,
    onEvent: deps.onEvent,
    formatReport: (report, origin) => buildReportMessage(report, origin)
  });

  const startSchedulerFn = deps.startSchedulerFn ?? startScheduler;
  let schedulerStop: (() => void) | undefined;

  const start = async (): Promise<void> => {
    const handler: JobHandler = async (job: ScheduledJob) => {
      const payload = job.payload ?? {};
      const text = String(payload.text ?? payload.input ?? payload.prompt ?? "");
      await agentLoop.intake({
        type: "trigger",
        text,
        sessionId: payload.sessionId as string | undefined,
        userId: payload.userId as string | undefined,
        channelId: payload.channelId as string | undefined,
        chatType: payload.chatType as "dm" | "group" | "thread" | undefined
      });
    };
    const scheduler = startSchedulerFn(deps.agentId, handler, deps.schedulerIntervalMs);
    schedulerStop = scheduler.stop;
    await channelRuntime.start();
  };

  const stop = async (): Promise<void> => {
    schedulerStop?.();
    await channelRuntime.stop();
  };

  return { registry, channelRuntime, start, stop };
}

function buildReportMessage(report: AgentReport, origin: { channelId: string; userId: string; threadId?: string }): OutboundMessage {
  return {
    channelId: origin.channelId,
    userId: origin.userId,
    threadId: origin.threadId,
    timestamp: new Date().toISOString(),
    content: report.summary,
    metadata: {
      success: report.success,
      actions: report.actions.length
    }
  };
}

function registerDefaultChannels(registry: ChannelRegistry, config: NormalizedConfig): void {
  const telegram = config.channels?.telegram;
  if (telegram?.enabled) {
    registry.register(new TelegramClient(telegram));
  }
  const discord = config.channels?.discord;
  if (discord?.enabled) {
    registry.register(new DiscordClient(discord));
  }
  const whatsapp = config.channels?.whatsapp;
  if (whatsapp?.enabled) {
    if (whatsapp.provider === "web") {
      registry.register(new WhatsAppWebClient(whatsapp.sessionDir));
    } else {
      registry.register(new WhatsAppCloudClient(whatsapp));
    }
  }
}

function parseArgs(argv: string[]): { agentId: string; intervalMs?: number } {
  const args = argv.slice(2);
  const agentIndex = args.indexOf("--agent");
  if (agentIndex === -1) {
    throw new Error("Usage: praxis runtime --agent <id> [--interval 60000]");
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
  const config = normalizeConfig(await loadConfig(agentId));
  await selectProviderWithProbe({ inference: config.inference, providers: config.providers });

  const runtime = await createRuntime({
    agentId,
    config,
    schedulerIntervalMs: intervalMs,
    onEvent: (event) => {
      void appendChannelEvent(agentId, event);
    }
  });

  await runtime.start();
  process.stdout.write("runtime started\n");

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

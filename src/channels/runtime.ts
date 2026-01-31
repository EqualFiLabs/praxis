import type { AgentLoop, AgentReport } from "../agent/loop";
import type { ChannelRegistry } from "./registry";
import type { ChannelEvent, ChannelId, MsgContext, OutboundMessage } from "./types";
import type { ChannelPlugin } from "./plugins/types";
import { resolveSessionKey } from "../routing/session";

export type ChannelHealth = {
  channelId: ChannelId;
  enabled: boolean;
  ok: boolean;
  details?: string;
};

export type ChannelRuntimeOptions = {
  registry: ChannelRegistry;
  agentLoop: AgentLoop;
  plugins?: Record<string, ChannelPlugin>;
  enabledChannels?: Record<string, boolean>;
  onEvent?: (event: ChannelEvent) => void;
  formatReport?: (report: AgentReport, origin: MsgContext) => OutboundMessage | null;
};

export class ChannelRuntimeManager {
  private readonly registry: ChannelRegistry;
  private readonly agentLoop: AgentLoop;
  private readonly plugins: Record<string, ChannelPlugin>;
  private readonly enabledChannels: Record<string, boolean>;
  private readonly onEvent?: (event: ChannelEvent) => void;
  private readonly formatReport?: (report: AgentReport, origin: MsgContext) => OutboundMessage | null;

  constructor(options: ChannelRuntimeOptions) {
    this.registry = options.registry;
    this.agentLoop = options.agentLoop;
    this.plugins = options.plugins ?? {};
    this.enabledChannels = options.enabledChannels ?? {};
    this.onEvent = options.onEvent;
    this.formatReport = options.formatReport;
  }

  async start(): Promise<void> {
    this.registry.onMessage((message) => this.routeInbound(message));
    await this.registry.startAll();
    this.emitEvent("connected", "runtime");
  }

  async stop(): Promise<void> {
    await this.registry.stopAll();
    this.emitEvent("disconnected", "runtime");
  }

  probe(): ChannelHealth[] {
    return this.registry.list().map((client) => {
      const enabled = this.enabledChannels[client.id] ?? true;
      return {
        channelId: client.id,
        enabled,
        ok: enabled,
        details: enabled ? "ready" : "disabled"
      };
    });
  }

  async routeInbound(message: MsgContext): Promise<void> {
    const sessionId = message.sessionKey || resolveSessionKey(message);
    this.emitEvent("message", message.channelId, {
      direction: "inbound",
      sessionKey: sessionId,
      metadata: message.metadata
    });
    try {
      const report = await this.agentLoop.intake({
        type: "prompt",
        text: message.content,
        sessionId
      });
      if (this.formatReport) {
        const outbound = this.formatReport(report, message);
        if (outbound) {
          await this.routeOutbound(outbound, message);
        }
      }
    } catch (error) {
      this.emitEvent("error", message.channelId, {
        direction: "inbound",
        sessionKey: sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async routeOutbound(message: OutboundMessage, origin?: MsgContext): Promise<void> {
    const outbound = this.applyOrigin(message, origin);
    const plugin = this.plugins[String(outbound.channelId)];
    const sessionKey = origin?.sessionKey;
    this.emitEvent("message", outbound.channelId, {
      direction: "outbound",
      sessionKey,
      metadata: outbound.metadata
    });
    try {
      if (plugin?.outbound?.sendPayload) {
        await plugin.outbound.sendPayload(outbound);
        return;
      }
      if (plugin?.outbound?.buildPayload) {
        const payload = plugin.outbound.buildPayload(outbound);
        outbound.metadata = { ...outbound.metadata, outboundPayload: payload };
      }
      await this.registry.send(outbound);
    } catch (error) {
      this.emitEvent("error", outbound.channelId, {
        direction: "outbound",
        sessionKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private applyOrigin(message: OutboundMessage, origin?: MsgContext): OutboundMessage {
    if (!origin) return message;
    const metadata = { ...origin.metadata, ...message.metadata, sessionKey: origin.sessionKey };
    return {
      ...message,
      channelId: origin.channelId,
      userId: message.userId ?? (origin.metadata?.chatId as string | undefined) ?? origin.userId,
      threadId: message.threadId ?? origin.threadId,
      metadata
    };
  }

  private emitEvent(
    type: ChannelEvent["type"],
    channelId: ChannelId,
    details?: ChannelEvent["details"] & {
      direction?: "inbound" | "outbound";
      sessionKey?: string;
      error?: string;
      metadata?: Record<string, unknown>;
    }
  ): void {
    if (!this.onEvent) return;
    this.onEvent({
      type,
      channelId,
      timestamp: new Date().toISOString(),
      details
    });
  }
}

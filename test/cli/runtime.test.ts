import { describe, expect, it, vi } from "vitest";
import type { AgentLoop, AgentReport } from "../../src/agent/loop";
import type { ChannelClient, MsgContext, OutboundMessage } from "../../src/channels/types";
import type { AgentConfig } from "../../src/types/config";
import { normalizeConfig } from "../../src/config/normalized";
import { ChannelRegistry } from "../../src/channels/registry";
import { createRuntime } from "../../src/cli/runtime";

class FakeClient implements ChannelClient {
  public readonly id = "telegram";
  public sent: OutboundMessage[] = [];
  private handler?: (message: MsgContext) => void | Promise<void>;

  onMessage(handler: (message: MsgContext) => void | Promise<void>): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    if (this.handler) {
      await this.handler({
        channelId: "telegram",
        userId: "user",
        threadId: undefined,
        timestamp: new Date().toISOString(),
        content: "hello",
        metadata: { chatId: "chat" },
        chatType: "dm",
        sessionKey: "session"
      });
    }
  }

  async stop(): Promise<void> {
    return;
  }

  async send(message: OutboundMessage): Promise<void> {
    this.sent.push(message);
  }
}

function baseConfig(): AgentConfig {
  return {
    agent: { id: "agent", profile: "test" },
    auth: { ownerKeyEnv: "OWNER_KEY" },
    inference: {
      provider: "ollama",
      privacy: { allowExternal: false, allowSensitiveMemory: false }
    },
    providers: {
      ollama: {
        type: "ollama",
        baseUrl: "http://localhost:11434",
        model: "test",
        contextWindow: 4096,
        maxOutputTokens: 512,
        timeoutMs: 5000
      }
    },
    chain: {
      rpcUrl: "http://localhost",
      chainId: 1,
      tbaAddress: "0x123",
      positionNftAddress: "0x456",
      positionTokenId: "1"
    }
  };
}

describe("runtime wiring", () => {
  it("routes inbound to agent loop and sends outbound replies", async () => {
    const config = normalizeConfig(baseConfig());
    const registry = new ChannelRegistry();
    const client = new FakeClient();
    registry.register(client);

    const report: AgentReport = { summary: "ok", success: true, actions: [] };
    const agentLoop = {
      intake: vi.fn().mockResolvedValue(report)
    } as unknown as AgentLoop;

    const schedulerStop = vi.fn();
    const startSchedulerFn = vi.fn().mockReturnValue({ stop: schedulerStop });

    const runtime = await createRuntime({
      agentId: "agent",
      config,
      registry,
      agentLoop,
      startSchedulerFn,
      skipAutoRegister: true
    });

    await runtime.start();

    expect(agentLoop.intake).toHaveBeenCalled();
    expect(client.sent.length).toBe(1);
    expect(client.sent[0].content).toBe("ok");
    expect(startSchedulerFn).toHaveBeenCalled();

    await runtime.stop();
  });
});

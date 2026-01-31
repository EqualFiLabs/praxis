import { describe, expect, it } from "vitest";
import { normalizeDiscordInbound } from "../../src/channels/discord";
import { buildDiscordPayload } from "../../src/channels/plugins/outbound/discord";

describe("normalizeDiscordInbound", () => {
  it("returns null when disabled", () => {
    const result = normalizeDiscordInbound(
      { enabled: false, botTokenEnv: "DISCORD_TOKEN" },
      { senderId: "alice", channelId: "1", text: "hi" }
    );
    expect(result).toBeNull();
  });

  it("returns context when enabled", () => {
    const result = normalizeDiscordInbound(
      { enabled: true, botTokenEnv: "DISCORD_TOKEN", allowFrom: ["alice"] },
      { senderId: "alice", channelId: "1", text: "hi", isGroup: true }
    );
    expect(result?.channelId).toBe("discord");
    expect(result?.userId).toBe("alice");
    expect(result?.metadata?.channelId).toBe("1");
  });
});

describe("buildDiscordPayload", () => {
  it("uses channelId for outbound payload", () => {
    const payload = buildDiscordPayload({
      content: "hello",
      metadata: { channelId: "123" }
    });
    expect(payload.channel_id).toBe("123");
    expect(payload.content).toBe("hello");
  });
});

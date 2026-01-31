import { describe, expect, it } from "vitest";
import { applyInboundPolicy, resolveAllowFrom } from "../../src/channels/dock";
import type { InboundMessage } from "../../src/channels/types";

describe("dock policy helpers", () => {
  it("formats allowlists per channel", () => {
    const telegram = resolveAllowFrom("telegram", ["telegram:123", "tg:456"]);
    expect(telegram).toEqual(["123", "456"]);

    const discord = resolveAllowFrom("discord", ["ALICE"]);
    expect(discord).toEqual(["alice"]);
  });

  it("enforces mention gating when required", () => {
    const inbound: InboundMessage = {
      channelId: "discord",
      userId: "alice",
      timestamp: new Date().toISOString(),
      content: "hello",
      metadata: { isGroup: true, channelId: "c1" }
    };
    const result = applyInboundPolicy("discord", inbound, {
      allowFrom: ["alice"],
      mentionPolicy: { requireInGroups: true, patterns: ["@bot"] }
    });
    expect(result).toBeNull();
  });
});

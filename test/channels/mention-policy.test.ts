import { describe, expect, it } from "vitest";
import { applyInboundPolicy } from "../../src/channels/dock";
import type { InboundMessage } from "../../src/channels/types";

describe("mention policy", () => {
  it("rejects group messages without required mention", () => {
    const inbound: InboundMessage = {
      channelId: "telegram",
      userId: "alice",
      timestamp: new Date().toISOString(),
      content: "hello there",
      metadata: { isGroup: true, chatId: "g1" }
    };
    const result = applyInboundPolicy("telegram", inbound, {
      allowFrom: ["alice"],
      mentionPolicy: { requireInGroups: true, patterns: ["@bot"] }
    });
    expect(result).toBeNull();
  });

  it("accepts group messages when mention pattern matches", () => {
    const inbound: InboundMessage = {
      channelId: "telegram",
      userId: "alice",
      timestamp: new Date().toISOString(),
      content: "hello @bot",
      metadata: { isGroup: true, chatId: "g1" }
    };
    const result = applyInboundPolicy("telegram", inbound, {
      allowFrom: ["alice"],
      mentionPolicy: { requireInGroups: true, patterns: ["@bot"] }
    });
    expect(result).not.toBeNull();
  });
});

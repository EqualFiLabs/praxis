import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { applyInboundPolicy, resolveAllowFrom } from "../../src/channels/dock";
import type { OutboundMessage } from "../../src/channels/types";
import { buildSessionKey, resolveSessionKey } from "../../src/routing/session";
import { telegramOutbound } from "../../src/channels/plugins/outbound/telegram";
import { discordOutbound } from "../../src/channels/plugins/outbound/discord";
import { whatsappOutbound } from "../../src/channels/plugins/outbound/whatsapp";

describe("Property: allowlist formatting", () => {
  it("strips telegram prefixes and lowercases discord allowlists", () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
    const tokenArb = fc
      .array(fc.constantFrom(...chars.split("")), { minLength: 1 })
      .map((arr) => arr.join(""));
    fc.assert(
      fc.property(tokenArb, (id) => {
        const telegram = resolveAllowFrom("telegram", [`telegram:${id}`, `tg:${id}`]);
        expect(telegram).toContain(id);

        const discord = resolveAllowFrom("discord", [id.toUpperCase()]);
        expect(discord).toContain(id.toLowerCase());
      })
    );
  });
});

describe("Property: session key shape", () => {
  it("builds deterministic session keys for dm/group/thread", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (senderId, groupId, threadId) => {
          const dmKey = buildSessionKey({ channelId: "telegram", senderId });
          const groupKey = buildSessionKey({ channelId: "telegram", senderId, groupId });
          const threadKey = buildSessionKey({
            channelId: "telegram",
            senderId,
            groupId,
            threadId
          });
          expect(dmKey).toContain(":dm:");
          expect(groupKey).toContain(":group:");
          expect(threadKey).toContain(":thread:");
        }
      )
    );
  });
});

describe("Property: inbound policy gating", () => {
  it("rejects senders not in allowlist", () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
    const tokenArb = fc
      .array(fc.constantFrom(...chars.split("")), { minLength: 1 })
      .map((arr) => arr.join(""));
    fc.assert(
      fc.property(tokenArb, tokenArb, (allowed, other) => {
        const allowedId = allowed;
        const deniedId = other === allowed ? `${other}-x` : other;
        const base = {
          channelId: "telegram",
          userId: allowedId,
          timestamp: new Date().toISOString(),
          content: "hello",
          metadata: {}
        };
        const allowedResult = applyInboundPolicy("telegram", base, {
          allowFrom: [allowedId]
        });
        const deniedResult = applyInboundPolicy(
          "telegram",
          { ...base, userId: deniedId },
          { allowFrom: [allowedId] }
        );
        expect(allowedResult).not.toBeNull();
        expect(deniedResult).toBeNull();
        if (allowedResult) {
          expect(allowedResult.sessionKey).toBe(resolveSessionKey(base));
        }
      })
    );
  });
});

describe("Property: outbound payload builders", () => {
  it("builds payloads when a userId is provided", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (userId, text) => {
        const message: OutboundMessage = { channelId: "telegram", userId, content: text };
        const tgPayload = telegramOutbound.buildPayload?.(message);
        const dcPayload = discordOutbound.buildPayload?.({
          channelId: "discord",
          userId,
          content: text
        } as OutboundMessage);
        const waPayload = whatsappOutbound.buildPayload?.({
          channelId: "whatsapp",
          userId,
          content: text
        } as OutboundMessage);
        expect((tgPayload as any)?.chat_id).toBe(userId);
        expect((dcPayload as any)?.channel_id).toBe(userId);
        expect((waPayload as any)?.to).toBe(userId);
      })
    );
  });
});

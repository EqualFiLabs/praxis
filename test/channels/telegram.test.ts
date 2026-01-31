import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildTelegramSendPayload, normalizeTelegramInbound } from "../../src/channels/telegram";

describe("normalizeTelegramInbound", () => {
  it("returns null when disabled", () => {
    const result = normalizeTelegramInbound(
      { enabled: false, botTokenEnv: "TELEGRAM_TOKEN" },
      { senderId: "alice", chatId: "1", text: "hi" }
    );
    expect(result).toBeNull();
  });

  it("returns inbound message when enabled and allowed", () => {
    const result = normalizeTelegramInbound(
      { enabled: true, botTokenEnv: "TELEGRAM_TOKEN", allowFrom: ["alice"] },
      { senderId: "alice", chatId: "1", text: "hi" }
    );
    expect(result?.channelId).toBe("telegram");
    expect(result?.userId).toBe("alice");
    expect(result?.content).toBe("hi");
    expect(result?.sessionKey).toContain("telegram");
  });
});

describe("buildTelegramSendPayload", () => {
  it("uses userId as chat_id and includes thread id", () => {
    const payload = buildTelegramSendPayload({
      channelId: "telegram",
      userId: "42",
      threadId: "123",
      content: "hello"
    });
    expect(payload.chat_id).toBe("42");
    expect(payload.message_thread_id).toBe(123);
  });

  it("uses metadata chatId when provided", () => {
    const payload = buildTelegramSendPayload({
      channelId: "telegram",
      content: "hello",
      metadata: { chatId: "999" }
    });
    expect(payload.chat_id).toBe("999");
  });
});

describe("allowlist enforcement (property)", () => {
  it("only allows senders on allowFrom list", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (allowed, other) => {
          const config = {
            enabled: true,
            botTokenEnv: "TELEGRAM_TOKEN",
            allowFrom: [allowed]
          };
          const allowedResult = normalizeTelegramInbound(config, {
            senderId: allowed,
            chatId: "1",
            text: "ok"
          });
          const deniedResult = normalizeTelegramInbound(config, {
            senderId: other === allowed ? `${other}-x` : other,
            chatId: "1",
            text: "no"
          });
          expect(allowedResult).not.toBeNull();
          expect(deniedResult).toBeNull();
        }
      )
    );
  });
});

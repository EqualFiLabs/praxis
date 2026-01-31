import { describe, expect, it } from "vitest";
import { normalizeWhatsappInbound, WhatsAppCloudClient } from "../../src/channels/whatsapp";
import { buildWhatsAppPayload } from "../../src/channels/plugins/outbound/whatsapp";

describe("normalizeWhatsappInbound", () => {
  it("returns null when disabled", () => {
    const result = normalizeWhatsappInbound(
      { enabled: false, sessionDir: "phone" },
      { senderId: "alice", chatId: "1", text: "hi" }
    );
    expect(result).toBeNull();
  });

  it("returns context when enabled and allowed", () => {
    const result = normalizeWhatsappInbound(
      { enabled: true, sessionDir: "phone", allowFrom: ["alice"] },
      { senderId: "alice", chatId: "1", text: "hi" }
    );
    expect(result?.channelId).toBe("whatsapp");
    expect(result?.userId).toBe("alice");
    expect(result?.metadata?.chatId).toBe("1");
  });
});

describe("buildWhatsAppPayload", () => {
  it("uses userId as target when provided", () => {
    const payload = buildWhatsAppPayload({
      content: "hello",
      userId: "+15550001"
    });
    expect(payload.to).toBe("+15550001");
    expect(payload.text).toBe("hello");
  });
});

describe("WhatsAppCloudClient webhook handling", () => {
  it("normalizes inbound webhook messages", async () => {
    const client = new WhatsAppCloudClient({
      enabled: true,
      sessionDir: "phone",
      allowFrom: ["+15550001"]
    });
    const received: string[] = [];
    client.onMessage((msg) => {
      received.push(msg.content);
    });
    await client.handleWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "+15550001",
                    id: "m1",
                    timestamp: "0",
                    text: { body: "hello" }
                  }
                ]
              }
            }
          ]
        }
      ]
    });
    expect(received).toEqual(["hello"]);
  });
});

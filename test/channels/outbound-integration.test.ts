import { describe, expect, it } from "vitest";
import type { OutboundMessage } from "../../src/channels/types";
import { telegramOutbound } from "../../src/channels/plugins/outbound/telegram";
import { discordOutbound } from "../../src/channels/plugins/outbound/discord";
import { whatsappOutbound } from "../../src/channels/plugins/outbound/whatsapp";

describe("outbound adapters", () => {
  it("builds telegram payload with chatId metadata", () => {
    const msg: OutboundMessage = {
      channelId: "telegram",
      content: "hello",
      metadata: { chatId: "42" }
    };
    const payload = telegramOutbound.buildPayload?.(msg) as { chat_id: string; text: string };
    expect(payload.chat_id).toBe("42");
    expect(payload.text).toBe("hello");
  });

  it("builds discord payload with channelId metadata", () => {
    const msg: OutboundMessage = {
      channelId: "discord",
      content: "hello",
      metadata: { channelId: "99" }
    };
    const payload = discordOutbound.buildPayload?.(msg) as { channel_id: string; content: string };
    expect(payload.channel_id).toBe("99");
    expect(payload.content).toBe("hello");
  });

  it("builds whatsapp payload with userId fallback", () => {
    const msg: OutboundMessage = {
      channelId: "whatsapp",
      userId: "+1555",
      content: "hello"
    };
    const payload = whatsappOutbound.buildPayload?.(msg) as { to: string; text: string };
    expect(payload.to).toBe("+1555");
    expect(payload.text).toBe("hello");
  });
});

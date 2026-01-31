import type { ChannelOutboundAdapter } from "../types";

export type WhatsAppOutboundPayload = {
  to: string;
  text: string;
};

export function buildWhatsAppPayload(message: {
  content: string;
  metadata?: Record<string, unknown>;
  userId?: string;
}): WhatsAppOutboundPayload {
  const target =
    (message.metadata?.to as string | undefined) ??
    message.userId ??
    (message.metadata?.chatId as string | undefined);
  if (!target) {
    throw new Error("WhatsApp outbound requires target");
  }
  return {
    to: target,
    text: message.content
  };
}

export const whatsappOutbound: ChannelOutboundAdapter = {
  id: "whatsapp",
  buildPayload: (message) => buildWhatsAppPayload(message)
};

import type { ChannelOutboundAdapter } from "../types";

export type DiscordOutboundPayload = {
  channel_id: string;
  content: string;
  message_reference?: {
    message_id?: string;
  };
};

export function buildDiscordPayload(message: {
  content: string;
  metadata?: Record<string, unknown>;
  userId?: string;
}): DiscordOutboundPayload {
  const channelId =
    (message.metadata?.channelId as string | undefined) ??
    message.userId ??
    (message.metadata?.to as string | undefined);
  if (!channelId) {
    throw new Error("Discord outbound requires channelId or userId");
  }
  return {
    channel_id: channelId,
    content: message.content
  };
}

export const discordOutbound: ChannelOutboundAdapter = {
  id: "discord",
  buildPayload: (message) => buildDiscordPayload(message)
};

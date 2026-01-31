import type { ChannelsConfig } from "../../types/config";

export type WhatsAppOnboardingResult = {
  allowed: boolean;
  message: string;
};

export function requestWhatsAppOnboarding(
  config: ChannelsConfig["whatsapp"],
  senderId: string
): WhatsAppOnboardingResult {
  if (!config?.enabled) {
    return {
      allowed: false,
      message: "WhatsApp channel is disabled."
    };
  }
  const allowFrom = config.allowFrom ?? [];
  if (allowFrom.length === 0 || allowFrom.includes(senderId)) {
    return {
      allowed: true,
      message: "Sender is allowed."
    };
  }
  return {
    allowed: false,
    message: `Add ${senderId} to channels.whatsapp.allowFrom to enable access.`
  };
}

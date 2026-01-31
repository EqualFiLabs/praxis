import type { ChannelOutboundAdapter } from "../types";
import { buildTelegramSendPayload } from "../../telegram";

export const telegramOutbound: ChannelOutboundAdapter = {
  id: "telegram",
  buildPayload: (message) => buildTelegramSendPayload(message)
};

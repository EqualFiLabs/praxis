import type { AgentConfig, ChannelsConfig } from "../types/config";
import type { DiscordAccount } from "../channels/accounts/discord";
import type { TelegramAccount } from "../channels/accounts/telegram";
import type { WhatsAppAccount } from "../channels/accounts/whatsapp";
import { resolveDiscordAccounts } from "../channels/accounts/discord";
import { resolveTelegramAccounts } from "../channels/accounts/telegram";
import { resolveWhatsAppAccounts } from "../channels/accounts/whatsapp";

export type NormalizedChannels = {
  telegram: TelegramAccount[];
  discord: DiscordAccount[];
  whatsapp: WhatsAppAccount[];
};

const EMPTY_CHANNELS: NormalizedChannels = {
  telegram: [],
  discord: [],
  whatsapp: []
};

export function normalizeChannelsConfig(config: AgentConfig): NormalizedChannels {
  if (!config.channels) {
    return EMPTY_CHANNELS;
  }
  return {
    telegram: resolveTelegramAccounts(config.channels.telegram, {
      accounts: config.channels.telegram?.accounts,
      defaultAccountId: config.channels.telegram?.defaultAccountId
    }),
    discord: resolveDiscordAccounts(config.channels.discord, {
      accounts: config.channels.discord?.accounts,
      defaultAccountId: config.channels.discord?.defaultAccountId
    }),
    whatsapp: resolveWhatsAppAccounts(config.channels.whatsapp, {
      accounts: config.channels.whatsapp?.accounts,
      defaultAccountId: config.channels.whatsapp?.defaultAccountId
    })
  };
}

export function normalizeChannelAllowFrom(allowFrom: string[] | undefined): string[] {
  if (!allowFrom) return [];
  return allowFrom.map((entry) => entry.trim()).filter(Boolean);
}

export function normalizeChannelsConfigFromPartial(
  channels: ChannelsConfig | undefined
): NormalizedChannels {
  if (!channels) {
    return EMPTY_CHANNELS;
  }
  return {
    telegram: resolveTelegramAccounts(channels.telegram, {
      accounts: channels.telegram?.accounts,
      defaultAccountId: channels.telegram?.defaultAccountId
    }),
    discord: resolveDiscordAccounts(channels.discord, {
      accounts: channels.discord?.accounts,
      defaultAccountId: channels.discord?.defaultAccountId
    }),
    whatsapp: resolveWhatsAppAccounts(channels.whatsapp, {
      accounts: channels.whatsapp?.accounts,
      defaultAccountId: channels.whatsapp?.defaultAccountId
    })
  };
}

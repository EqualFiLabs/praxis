import type { ChannelsConfig } from "../../types/config";
import { resolveSecretFromEnv } from "../../utils/secrets";

export type TelegramAccount = {
  id: string;
  enabled: boolean;
  botTokenEnv: string;
  apiBaseUrl?: string;
  webhookUrl?: string;
  polling?: boolean;
  allowFrom: string[];
};

export type TelegramAccountEntry = {
  enabled?: boolean;
  botTokenEnv: string;
  apiBaseUrl?: string;
  webhookUrl?: string;
  polling?: boolean;
  allowFrom?: string[];
};

export type TelegramAccountsConfig = {
  defaultAccountId?: string;
  accounts?: Record<string, TelegramAccountEntry>;
};

export function resolveTelegramAccounts(
  config: ChannelsConfig["telegram"],
  accounts?: TelegramAccountsConfig
): TelegramAccount[] {
  const resolved: TelegramAccount[] = [];

  if (accounts?.accounts && Object.keys(accounts.accounts).length > 0) {
    for (const [id, entry] of Object.entries(accounts.accounts)) {
      resolved.push({
        id,
        enabled: entry.enabled ?? true,
        botTokenEnv: entry.botTokenEnv,
        apiBaseUrl: entry.apiBaseUrl,
        webhookUrl: entry.webhookUrl,
        polling: entry.polling,
        allowFrom: entry.allowFrom ?? []
      });
    }
  }

  if (config) {
    resolved.push({
      id: accounts?.defaultAccountId ?? "default",
      enabled: config.enabled,
      botTokenEnv: config.botTokenEnv,
      apiBaseUrl: config.apiBaseUrl,
      webhookUrl: config.webhookUrl,
      polling: config.polling,
      allowFrom: config.allowFrom ?? []
    });
  }

  return dedupeAccounts(resolved);
}

export function resolveTelegramAccount(
  config: ChannelsConfig["telegram"],
  accounts?: TelegramAccountsConfig,
  accountId?: string
): TelegramAccount | undefined {
  const all = resolveTelegramAccounts(config, accounts);
  if (accountId) {
    return all.find((entry) => entry.id === accountId);
  }
  const preferred = accounts?.defaultAccountId ?? "default";
  return all.find((entry) => entry.id === preferred) ?? all[0];
}

export function resolveTelegramToken(account: TelegramAccount): string {
  return resolveSecretFromEnv(account.botTokenEnv, "telegram bot token");
}

function dedupeAccounts(accounts: TelegramAccount[]): TelegramAccount[] {
  const seen = new Map<string, TelegramAccount>();
  for (const account of accounts) {
    seen.set(account.id, account);
  }
  return Array.from(seen.values());
}

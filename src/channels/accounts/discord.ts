import type { ChannelsConfig } from "../../types/config";
import { resolveSecretFromEnv } from "../../utils/secrets";

export type DiscordAccount = {
  id: string;
  enabled: boolean;
  botTokenEnv: string;
  apiBaseUrl?: string;
  appId?: string;
  publicKeyEnv?: string;
  allowFrom: string[];
};

export type DiscordAccountEntry = {
  enabled?: boolean;
  botTokenEnv: string;
  apiBaseUrl?: string;
  appId?: string;
  publicKeyEnv?: string;
  allowFrom?: string[];
};

export type DiscordAccountsConfig = {
  defaultAccountId?: string;
  accounts?: Record<string, DiscordAccountEntry>;
};

export function resolveDiscordAccounts(
  config: ChannelsConfig["discord"],
  accounts?: DiscordAccountsConfig
): DiscordAccount[] {
  const resolved: DiscordAccount[] = [];

  if (accounts?.accounts && Object.keys(accounts.accounts).length > 0) {
    for (const [id, entry] of Object.entries(accounts.accounts)) {
      resolved.push({
        id,
        enabled: entry.enabled ?? true,
        botTokenEnv: entry.botTokenEnv,
        apiBaseUrl: entry.apiBaseUrl,
        appId: entry.appId,
        publicKeyEnv: entry.publicKeyEnv,
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
      appId: config.appId,
      publicKeyEnv: config.publicKeyEnv,
      allowFrom: config.allowFrom ?? []
    });
  }

  return dedupeAccounts(resolved);
}

export function resolveDiscordAccount(
  config: ChannelsConfig["discord"],
  accounts?: DiscordAccountsConfig,
  accountId?: string
): DiscordAccount | undefined {
  const all = resolveDiscordAccounts(config, accounts);
  if (accountId) {
    return all.find((entry) => entry.id === accountId);
  }
  const preferred = accounts?.defaultAccountId ?? "default";
  return all.find((entry) => entry.id === preferred) ?? all[0];
}

export function resolveDiscordToken(account: DiscordAccount): string {
  return resolveSecretFromEnv(account.botTokenEnv, "discord bot token");
}

export function resolveDiscordPublicKey(account: DiscordAccount): string | undefined {
  if (!account.publicKeyEnv) return undefined;
  return resolveSecretFromEnv(account.publicKeyEnv, "discord public key");
}

function dedupeAccounts(accounts: DiscordAccount[]): DiscordAccount[] {
  const seen = new Map<string, DiscordAccount>();
  for (const account of accounts) {
    seen.set(account.id, account);
  }
  return Array.from(seen.values());
}

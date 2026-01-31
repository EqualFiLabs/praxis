import type { ChannelsConfig } from "../../types/config";

export type WhatsAppAccount = {
  id: string;
  enabled: boolean;
  sessionDir: string;
  provider?: "cloud" | "web";
  apiBaseUrl?: string;
  allowFrom: string[];
};

export type WhatsAppAccountEntry = {
  enabled?: boolean;
  sessionDir: string;
  provider?: "cloud" | "web";
  apiBaseUrl?: string;
  allowFrom?: string[];
};

export type WhatsAppAccountsConfig = {
  defaultAccountId?: string;
  accounts?: Record<string, WhatsAppAccountEntry>;
};

export function resolveWhatsAppAccounts(
  config: ChannelsConfig["whatsapp"],
  accounts?: WhatsAppAccountsConfig
): WhatsAppAccount[] {
  const resolved: WhatsAppAccount[] = [];

  if (accounts?.accounts && Object.keys(accounts.accounts).length > 0) {
    for (const [id, entry] of Object.entries(accounts.accounts)) {
      resolved.push({
        id,
        enabled: entry.enabled ?? true,
        sessionDir: entry.sessionDir,
        provider: entry.provider,
        apiBaseUrl: entry.apiBaseUrl,
        allowFrom: entry.allowFrom ?? []
      });
    }
  }

  if (config) {
    resolved.push({
      id: accounts?.defaultAccountId ?? "default",
      enabled: config.enabled,
      sessionDir: config.sessionDir,
      provider: config.provider,
      apiBaseUrl: config.apiBaseUrl,
      allowFrom: config.allowFrom ?? []
    });
  }

  return dedupeAccounts(resolved);
}

export function resolveWhatsAppAccount(
  config: ChannelsConfig["whatsapp"],
  accounts?: WhatsAppAccountsConfig,
  accountId?: string
): WhatsAppAccount | undefined {
  const all = resolveWhatsAppAccounts(config, accounts);
  if (accountId) {
    return all.find((entry) => entry.id === accountId);
  }
  const preferred = accounts?.defaultAccountId ?? "default";
  return all.find((entry) => entry.id === preferred) ?? all[0];
}

function dedupeAccounts(accounts: WhatsAppAccount[]): WhatsAppAccount[] {
  const seen = new Map<string, WhatsAppAccount>();
  for (const account of accounts) {
    seen.set(account.id, account);
  }
  return Array.from(seen.values());
}

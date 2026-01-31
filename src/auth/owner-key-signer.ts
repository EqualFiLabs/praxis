import type { Chain, Hex } from "viem";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import type { AgentConfig } from "../types/config";

export type OwnerKeySigner = {
  accountAddress: string;
  sendTransaction: (tx: {
    to: string;
    data?: Hex;
    value?: bigint;
  }) => Promise<Hex>;
};

export function loadOwnerKey(config: AgentConfig): Hex {
  const envKey = config.auth.ownerKeyEnv;
  const value = envKey ? process.env[envKey] : undefined;
  if (!value) {
    throw new Error(`Missing owner key for env ${envKey}`);
  }
  if (!value.startsWith("0x")) {
    return `0x${value}` as Hex;
  }
  return value as Hex;
}

export function createOwnerKeySigner(params: {
  config: AgentConfig;
  chain: Chain;
}): OwnerKeySigner {
  const privateKey = loadOwnerKey(params.config);
  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({
    account,
    chain: params.chain,
    transport: http(params.config.chain.rpcUrl)
  });

  return {
    accountAddress: account.address,
    sendTransaction: async (tx) => {
      return client.sendTransaction({
        account,
        to: tx.to,
        data: tx.data,
        value: tx.value ?? 0n
      });
    }
  };
}

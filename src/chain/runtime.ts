import type { Address, Hex, PublicClient, WalletClient } from "viem";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import type { AgentConfig } from "../types/config";
import type { PlannedAction } from "../types/execution";
import { loadOwnerKey } from "../auth/owner-key-signer";
import { getInstalledModules, isModuleInstalled } from "./module-registry";
import { execute } from "./tba-executor";
import { buildCalldata } from "./selector-validation";

export type ChainRuntime = {
  allowedSelectors: () => Promise<string[]>;
  hasGenericExec: () => Promise<boolean>;
  executeAction: (action: PlannedAction) => Promise<{ txHash?: string; error?: string }>;
};

export function createChainRuntime(params: {
  config: AgentConfig;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
}): ChainRuntime {
  const chain = defineChain({
    id: params.config.chain.chainId,
    name: `chain-${params.config.chain.chainId}`,
    network: `chain-${params.config.chain.chainId}`,
    nativeCurrency: { name: "Native", symbol: "NATIVE", decimals: 18 },
    rpcUrls: {
      default: { http: [params.config.chain.rpcUrl] }
    }
  });

  const publicClient =
    params.publicClient ??
    createPublicClient({
      chain,
      transport: http(params.config.chain.rpcUrl)
    });

  const walletClient =
    params.walletClient ??
    createWalletClient({
      chain,
      transport: http(params.config.chain.rpcUrl),
      account: privateKeyToAccount(loadOwnerKey(params.config))
    });

  const tbaAddress = params.config.chain.tbaAddress as Address;

  const allowedSelectors = async (): Promise<string[]> => {
    const modules = await getInstalledModules({ client: publicClient, tbaAddress });
    return modules.flatMap((module) => module.selectors);
  };

  const hasGenericExec = async (): Promise<boolean> => {
    const genericExecModule = params.config.chain.genericExecModule;
    if (!genericExecModule) return false;
    return isModuleInstalled({
      client: publicClient,
      tbaAddress,
      moduleAddress: genericExecModule as Address
    });
  };

  const executeAction = async (
    action: PlannedAction
  ): Promise<{ txHash?: string; error?: string }> => {
    try {
      const calldata = buildCalldata(action.selector, action.calldata as Hex);
      const value = parseValue(action.metadata?.value ?? action.metadata?.valueWei);
      const txHash = await execute({
        client: walletClient,
        tbaAddress,
        target: action.target as Address,
        calldata,
        value
      });
      return { txHash };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  };

  return { allowedSelectors, hasGenericExec, executeAction };
}

function parseValue(raw: unknown): bigint | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return BigInt(Math.trunc(raw));
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      return BigInt(raw.trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

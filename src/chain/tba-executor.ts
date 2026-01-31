import type { Address, Hex, PublicClient, WalletClient } from "viem";
import { ERC6551_EXECUTABLE_ABI, TBA_MODULE_VIEW_ABI } from "./abi";
import { requireGenericExecForExternalTarget, requireSelectorAllowed } from "./selector-validation";

export type ExecuteParams = {
  client: WalletClient;
  tbaAddress: Address;
  target: Address;
  value?: bigint;
  calldata: Hex;
};

export async function execute(params: ExecuteParams): Promise<Hex> {
  return params.client.writeContract({
    address: params.tbaAddress,
    abi: ERC6551_EXECUTABLE_ABI,
    functionName: "execute",
    args: [params.target, params.value ?? 0n, params.calldata, 0],
    value: params.value ?? 0n
  }) as Promise<Hex>;
}

export async function getInstalledSelectors(params: {
  client: PublicClient;
  tbaAddress: Address;
}): Promise<string[]> {
  const modules = (await params.client.readContract({
    address: params.tbaAddress,
    abi: TBA_MODULE_VIEW_ABI,
    functionName: "getInstalledExecutionModules"
  })) as Address[];

  const selectors: string[] = [];
  for (const module of modules) {
    const moduleSelectors = (await params.client.readContract({
      address: params.tbaAddress,
      abi: TBA_MODULE_VIEW_ABI,
      functionName: "getExecutionSelectors",
      args: [module]
    })) as string[];
    selectors.push(...moduleSelectors);
  }
  return selectors;
}

export async function isSelectorAllowed(params: {
  client: PublicClient;
  tbaAddress: Address;
  selector: string;
}): Promise<boolean> {
  const allowed = (await params.client.readContract({
    address: params.tbaAddress,
    abi: TBA_MODULE_VIEW_ABI,
    functionName: "isSelectorAllowed",
    args: [params.selector]
  })) as boolean;
  return allowed;
}

export function validateExecutionPolicy(params: {
  allowedSelectors: string[];
  selector: string;
  tbaAddress: Address;
  target: Address;
  hasGenericExec: boolean;
}): void {
  requireSelectorAllowed(params.allowedSelectors, params.selector);
  requireGenericExecForExternalTarget({
    tbaAddress: params.tbaAddress,
    target: params.target,
    hasGenericExec: params.hasGenericExec
  });
}

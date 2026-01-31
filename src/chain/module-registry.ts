import type { Address, PublicClient } from "viem";

import { TBA_MODULE_VIEW_ABI } from "./abi";

export type ModuleInfo = {
  address: Address;
  selectors: string[];
};

export async function getInstalledModules(params: {
  client: PublicClient;
  tbaAddress: Address;
}): Promise<ModuleInfo[]> {
  const modules = (await params.client.readContract({
    address: params.tbaAddress,
    abi: TBA_MODULE_VIEW_ABI,
    functionName: "getInstalledExecutionModules"
  })) as Address[];

  const infos: ModuleInfo[] = [];
  for (const module of modules) {
    const selectors = (await params.client.readContract({
      address: params.tbaAddress,
      abi: TBA_MODULE_VIEW_ABI,
      functionName: "getExecutionSelectors",
      args: [module]
    })) as string[];
    infos.push({ address: module, selectors });
  }
  return infos;
}

export async function getModuleSelectors(params: {
  client: PublicClient;
  tbaAddress: Address;
  moduleAddress: Address;
}): Promise<string[]> {
  return (await params.client.readContract({
    address: params.tbaAddress,
    abi: TBA_MODULE_VIEW_ABI,
    functionName: "getExecutionSelectors",
    args: [params.moduleAddress]
  })) as string[];
}

export async function isModuleInstalled(params: {
  client: PublicClient;
  tbaAddress: Address;
  moduleAddress: Address;
}): Promise<boolean> {
  const modules = (await params.client.readContract({
    address: params.tbaAddress,
    abi: TBA_MODULE_VIEW_ABI,
    functionName: "getInstalledExecutionModules"
  })) as Address[];
  return modules.map((m) => m.toLowerCase()).includes(params.moduleAddress.toLowerCase());
}

import type { Address, Hex } from "viem";

export function normalizeSelector(selector: string): string {
  return selector.toLowerCase();
}

export function isSelectorAllowed(allowed: string[], selector: string): boolean {
  const norm = normalizeSelector(selector);
  return allowed.map((s) => s.toLowerCase()).includes(norm);
}

export function requireSelectorAllowed(allowed: string[], selector: string): void {
  if (!isSelectorAllowed(allowed, selector)) {
    throw new Error(`MissingModuleError: selector ${selector}`);
  }
}

export function buildCalldata(selector: string, data: Hex): Hex {
  const normalizedSelector = selector.toLowerCase();
  if (!/^0x[0-9a-fA-F]{8}$/.test(normalizedSelector)) {
    throw new Error("Invalid selector");
  }
  let payload = data.startsWith("0x") ? data.slice(2) : data;
  if (payload.length % 2 === 1) {
    payload = `0${payload}`;
  }
  return (`${normalizedSelector}${payload}` as Hex) as Hex;
}

export function requireGenericExecForExternalTarget(params: {
  tbaAddress: Address;
  target: Address;
  hasGenericExec: boolean;
}): void {
  if (params.tbaAddress.toLowerCase() === params.target.toLowerCase()) return;
  if (!params.hasGenericExec) {
    throw new Error("GenericExecModuleRequired");
  }
}

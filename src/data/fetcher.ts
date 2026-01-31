import type { PublicClient, Address } from "viem";
import { fetchWithCache, markStale, type CachedData } from "./cache";

export type PositionState = {
  positionId: string;
  raw: unknown;
};

export type PoolData = {
  poolAddress: string;
  raw: unknown;
};

export type PriceData = {
  asset: string;
  price: number;
  source: string;
};

export async function getPositionState(params: {
  client: PublicClient;
  positionId: string;
}): Promise<PositionState> {
  const raw = await params.client.readContract({
    address: "0x0000000000000000000000000000000000000000" as Address,
    abi: [],
    functionName: ""
  });
  return { positionId: params.positionId, raw };
}

export async function getPoolData(params: {
  client: PublicClient;
  poolAddress: Address;
}): Promise<PoolData> {
  const raw = await params.client.readContract({
    address: params.poolAddress,
    abi: [],
    functionName: ""
  });
  return { poolAddress: params.poolAddress, raw };
}

export async function getPrice(asset: string): Promise<PriceData> {
  const price = 0;
  return { asset, price, source: "oracle" };
}

export { fetchWithCache, markStale, type CachedData };

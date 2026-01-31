import fs from "node:fs/promises";
import path from "node:path";

import { getAgentBasePath } from "../config/loader";
import type { Constraint, ConstraintType } from "../types/memory";
import type { ActionPlan, PlannedAction } from "../types/execution";

export type ConstraintResult = {
  passed: boolean;
  constraint: Constraint;
  reason?: string;
};

function getConstraintsPath(agentId: string): string {
  return path.join(getAgentBasePath(agentId), "memory", "constraints.json");
}

export async function loadConstraints(agentId: string): Promise<Constraint[]> {
  const constraintsPath = getConstraintsPath(agentId);
  try {
    const raw = await fs.readFile(constraintsPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Constraint[];
  } catch {
    return [];
  }
}

function normalizeArray(value: unknown): Array<string | number> {
  if (Array.isArray(value)) return value as Array<string | number>;
  if (typeof value === "string" || typeof value === "number") return [value];
  return [];
}

function getMetadataValue<T = unknown>(action: PlannedAction, key: string): T | undefined {
  const meta = action.metadata as Record<string, unknown> | undefined;
  return meta ? (meta[key] as T) : undefined;
}

function checkAllowedPools(action: PlannedAction, constraint: Constraint): ConstraintResult {
  const allowed = normalizeArray(constraint.value);
  const poolId = getMetadataValue<string | number>(action, "poolId");
  if (!poolId) {
    return { passed: false, constraint, reason: "missing poolId metadata" };
  }
  const passed = allowed.includes(poolId);
  return { passed, constraint, reason: passed ? undefined : "poolId not allowed" };
}

function checkMaxSlippage(action: PlannedAction, constraint: Constraint): ConstraintResult {
  const max = typeof constraint.value === "number" ? constraint.value : undefined;
  const slippage = getMetadataValue<number>(action, "slippageBps");
  if (max === undefined || slippage === undefined) {
    return { passed: false, constraint, reason: "missing slippage metadata" };
  }
  const passed = slippage <= max;
  return { passed, constraint, reason: passed ? undefined : "slippage exceeds max" };
}

function checkMaxExposure(action: PlannedAction, constraint: Constraint): ConstraintResult {
  const max = typeof constraint.value === "number" ? constraint.value : undefined;
  const exposure = getMetadataValue<number>(action, "exposure");
  if (max === undefined || exposure === undefined) {
    return { passed: false, constraint, reason: "missing exposure metadata" };
  }
  const passed = exposure <= max;
  return { passed, constraint, reason: passed ? undefined : "exposure exceeds max" };
}

function checkTimeWindow(_action: PlannedAction, constraint: Constraint): ConstraintResult {
  if (!constraint.value || typeof constraint.value !== "object") {
    return { passed: false, constraint, reason: "invalid timeWindow value" };
  }
  const { start, end } = constraint.value as { start?: string | number; end?: string | number };
  const startMs = start ? new Date(start).getTime() : undefined;
  const endMs = end ? new Date(end).getTime() : undefined;
  const now = Date.now();
  if (startMs && now < startMs) {
    return { passed: false, constraint, reason: "outside allowed time window" };
  }
  if (endMs && now > endMs) {
    return { passed: false, constraint, reason: "outside allowed time window" };
  }
  return { passed: true, constraint };
}

function checkDoNotTrade(action: PlannedAction, constraint: Constraint): ConstraintResult {
  const blocked = normalizeArray(constraint.value);
  const asset = getMetadataValue<string | number>(action, "asset");
  const poolId = getMetadataValue<string | number>(action, "poolId");
  if (asset && blocked.includes(asset)) {
    return { passed: false, constraint, reason: "asset is blocked" };
  }
  if (poolId && blocked.includes(poolId)) {
    return { passed: false, constraint, reason: "poolId is blocked" };
  }
  return { passed: true, constraint };
}

const handlers: Record<ConstraintType, (action: PlannedAction, c: Constraint) => ConstraintResult> = {
  allowedPools: checkAllowedPools,
  maxSlippage: checkMaxSlippage,
  maxExposure: checkMaxExposure,
  timeWindow: checkTimeWindow,
  doNotTrade: checkDoNotTrade
};

export function checkAction(action: PlannedAction, constraints: Constraint[]): ConstraintResult[] {
  return constraints
    .filter((c) => c.enabled)
    .map((constraint) => handlers[constraint.type](action, constraint));
}

export function checkPlan(plan: ActionPlan, constraints: Constraint[]): ConstraintResult[] {
  const results: ConstraintResult[] = [];
  for (const action of plan.actions) {
    results.push(...checkAction(action, constraints));
  }
  return results;
}

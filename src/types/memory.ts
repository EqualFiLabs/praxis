export type ConstraintType =
  | "allowedPools"
  | "maxSlippage"
  | "maxExposure"
  | "timeWindow"
  | "doNotTrade";

export type Constraint = {
  type: ConstraintType;
  value: unknown;
  enabled: boolean;
};

export type Preference = {
  key: string;
  value: string | number | boolean | null;
};

export type Memory = {
  constraints: Constraint[];
  preferences: Preference[];
  raw: string;
};

export type Decision = {
  id: string;
  timestamp: number;
  action: string;
  rationale: string;
  outcome?: string;
  txHash?: string;
};

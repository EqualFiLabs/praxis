import { z } from "zod";

export type PlannedAction = {
  selector: string;
  target: string;
  calldata: string;
  description: string;
};

export type ActionPlan = {
  actions: PlannedAction[];
  reasoning: string;
};

export type ExecutionReceipt = {
  success: boolean;
  txHash: string;
  blockNumber: number;
  gasUsed: bigint;
  error?: string;
};

export const PlannedActionSchema = z.object({
  selector: z.string().regex(/^0x[0-9a-fA-F]{8}$/),
  target: z.string().min(1),
  calldata: z.string().min(1),
  description: z.string().min(1)
});

export const ActionPlanSchema = z.object({
  actions: z.array(PlannedActionSchema),
  reasoning: z.string().min(1)
});

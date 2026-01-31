import crypto from "node:crypto";

import type { ActionPlan, PlannedAction } from "../types/execution";
import type { Constraint, Memory } from "../types/memory";
import type { TranscriptEntry } from "../types/session";
import { checkPlan, type ConstraintResult } from "../constraints/checker";
import { requireSelectorAllowed, requireGenericExecForExternalTarget } from "../chain/selector-validation";
import type { ActionPolicy, PolicyContext } from "../policies/actions";
import { evaluatePolicy } from "../policies/actions";
import type { TelemetryLogger } from "../telemetry/events";

export type AgentInput = {
  type: "prompt" | "trigger";
  text?: string;
  sessionId?: string;
  userId?: string;
  channelId?: string;
  chatType?: "dm" | "group" | "thread";
};

export type AgentContext = {
  memory: Memory;
  constraints: Constraint[];
  positionState?: unknown;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  constraintResults: ConstraintResult[];
};

export type ExecutedAction = {
  action: PlannedAction;
  txHash?: string;
  error?: string;
};

export type ExecutionResult = {
  success: boolean;
  actions: ExecutedAction[];
  error?: string;
};

export type AgentReport = {
  summary: string;
  success: boolean;
  actions: ExecutedAction[];
};

export type AgentLoopDeps = {
  agentId: string;
  tbaAddress: string;
  loadMemory: (agentId: string) => Promise<Memory>;
  saveMemory: (agentId: string, memory: Memory) => Promise<void>;
  loadConstraints: (agentId: string) => Promise<Constraint[]>;
  getPositionState?: (positionId: string) => Promise<unknown>;
  inferPlan: (context: AgentContext, input: AgentInput) => Promise<ActionPlan>;
  allowedSelectors: () => Promise<string[]>;
  hasGenericExec: () => Promise<boolean>;
  executeAction: (action: PlannedAction) => Promise<{ txHash?: string; error?: string }>;
  appendTranscript: (entry: TranscriptEntry) => Promise<void>;
  appendDecision: (decision: {
    id: string;
    timestamp: number;
    action: string;
    rationale: string;
    outcome?: string;
    txHash?: string;
  }) => Promise<void>;
  getActionPolicy?: () => ActionPolicy | undefined;
  telemetry?: TelemetryLogger;
};

export type AgentLoop = {
  intake: (input: AgentInput) => Promise<AgentReport>;
  assembleContext: () => Promise<AgentContext>;
  plan: (context: AgentContext, input: AgentInput) => Promise<ActionPlan>;
  validate: (plan: ActionPlan, input: AgentInput) => Promise<ValidationResult>;
  execute: (plan: ActionPlan, input: AgentInput) => Promise<ExecutionResult>;
  persist: (result: ExecutionResult, plan: ActionPlan, input: AgentInput) => Promise<void>;
  report: (result: ExecutionResult) => AgentReport;
};

function randomId(): string {
  return crypto.randomUUID();
}

export function createAgentLoop(deps: AgentLoopDeps): AgentLoop {
  const assembleContext = async (): Promise<AgentContext> => {
    const memory = await deps.loadMemory(deps.agentId);
    const constraints = await deps.loadConstraints(deps.agentId);
    return { memory, constraints };
  };

  const plan = async (context: AgentContext, input: AgentInput): Promise<ActionPlan> => {
    const actionPlan = await deps.inferPlan(context, input);
    await deps.telemetry?.log({
      type: "plan",
      timestamp: new Date().toISOString(),
      agentId: deps.agentId,
      sessionId: input.sessionId,
      channelId: input.channelId,
      metadata: { actions: actionPlan.actions.length }
    });
    return actionPlan;
  };

  const validate = async (actionPlan: ActionPlan, input: AgentInput): Promise<ValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const policyContext: PolicyContext = {
      agentId: deps.agentId,
      userId: input.userId,
      channelId: input.channelId,
      chatType: input.chatType,
      sessionId: input.sessionId
    };
    const actionPolicy = deps.getActionPolicy?.();

    const allowedSelectors = await deps.allowedSelectors();
    const hasGenericExec = await deps.hasGenericExec();

    for (const action of actionPlan.actions) {
      try {
        if (actionPolicy) {
          const decision = evaluatePolicy(action.selector, policyContext, actionPolicy);
          if (!decision.allowed) {
            errors.push(`action policy denied selector ${action.selector}`);
            continue;
          }
        }
        requireSelectorAllowed(allowedSelectors, action.selector);
        requireGenericExecForExternalTarget({
          tbaAddress: deps.tbaAddress as `0x${string}`,
          target: action.target as `0x${string}`,
          hasGenericExec
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(message);
      }
    }

    const constraintResults = checkPlan(actionPlan, (await assembleContext()).constraints);
    for (const result of constraintResults) {
      if (!result.passed) {
        errors.push(result.reason ?? "constraint violated");
      }
    }

    const result = {
      valid: errors.length === 0,
      errors,
      warnings,
      constraintResults
    };
    await deps.telemetry?.log({
      type: "validate",
      timestamp: new Date().toISOString(),
      agentId: deps.agentId,
      sessionId: input.sessionId,
      channelId: input.channelId,
      metadata: { valid: result.valid, errors: result.errors.length }
    });
    return result;
  };

  const execute = async (actionPlan: ActionPlan, input: AgentInput): Promise<ExecutionResult> => {
    const executed: ExecutedAction[] = [];
    let success = true;

    for (const action of actionPlan.actions) {
      const res = await deps.executeAction(action);
      if (res.error) {
        success = false;
      }
      executed.push({
        action,
        txHash: res.txHash,
        error: res.error
      });
    }

    const result = { success, actions: executed, error: success ? undefined : "execution failed" };
    await deps.telemetry?.log({
      type: "execute",
      timestamp: new Date().toISOString(),
      agentId: deps.agentId,
      sessionId: input.sessionId,
      channelId: input.channelId,
      metadata: { success: result.success, actions: result.actions.length }
    });
    return result;
  };

  const persist = async (
    result: ExecutionResult,
    plan: ActionPlan,
    input: AgentInput
  ): Promise<void> => {
    const timestamp = Date.now();
    if (!result.success) {
      await deps.appendTranscript({
        type: "error",
        text: result.error ?? "execution failed",
        timestamp
      });
      await deps.telemetry?.log({
        type: "persist",
        timestamp: new Date().toISOString(),
        agentId: deps.agentId,
        sessionId: input.sessionId,
        channelId: input.channelId,
        metadata: { success: false }
      });
      return;
    }

    for (const executed of result.actions) {
      await deps.appendDecision({
        id: randomId(),
        timestamp,
        action: executed.action.description,
        rationale: plan.reasoning,
        outcome: executed.error ? "failed" : "success",
        txHash: executed.txHash
      });
      await deps.appendTranscript({
        type: "action",
        text: executed.action.description,
        timestamp,
        metadata: {
          selector: executed.action.selector,
          txHash: executed.txHash,
          error: executed.error
        }
      });
    }

    const memory = await deps.loadMemory(deps.agentId);
    await deps.saveMemory(deps.agentId, memory);
    await deps.telemetry?.log({
      type: "persist",
      timestamp: new Date().toISOString(),
      agentId: deps.agentId,
      sessionId: input.sessionId,
      channelId: input.channelId,
      metadata: { success: true }
    });
  };

  const report = (result: ExecutionResult): AgentReport => {
    const summary = result.success ? "Execution succeeded" : "Execution failed";
    return { summary, success: result.success, actions: result.actions };
  };

  const intake = async (input: AgentInput): Promise<AgentReport> => {
    const context = await assembleContext();
    const actionPlan = await plan(context, input);
    const validation = await validate(actionPlan, input);
    if (!validation.valid) {
      await deps.appendTranscript({
        type: "error",
        text: validation.errors.join("; "),
        timestamp: Date.now()
      });
      return { summary: "Validation failed", success: false, actions: [] };
    }
    const execution = await execute(actionPlan, input);
    await persist(execution, actionPlan, input);
    return report(execution);
  };

  return {
    intake,
    assembleContext,
    plan,
    validate,
    execute,
    persist,
    report
  };
}

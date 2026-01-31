import type { ChatMessage } from "../inference/manager";
import type { AgentContext, AgentInput } from "../agent/loop";
import type { Constraint } from "../types/memory";

export const PLANNING_SYSTEM_PROMPT = `
You are a planning engine for an on-chain agent. Output must be valid JSON only.
Schema:
{
  "actions": [
    {
      "selector": "0x12345678",
      "target": "0x...",
      "calldata": "0x...",
      "description": "human readable"
    }
  ],
  "reasoning": "short rationale"
}
Rules:
- selector must be a 4-byte hex (0x + 8 hex chars).
- target and calldata must be non-empty.
- If no actions, return { "actions": [], "reasoning": "..." }.
`.trim();

export function buildPlanningMessages(
  context: AgentContext,
  input: AgentInput
): ChatMessage[] {
  return [
    { role: "system", content: PLANNING_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `User input: ${input.text ?? ""}`,
        "",
        "Memory:",
        context.memory.raw,
        "",
        "Constraints:",
        formatConstraints(context.constraints)
      ].join("\n")
    }
  ];
}

function formatConstraints(constraints: Constraint[]): string {
  if (!constraints || constraints.length === 0) return "(none)";
  return constraints
    .map((constraint) => {
      const value = constraint.value;
      return `- ${constraint.type}: ${typeof value === "string" ? value : JSON.stringify(value)}`;
    })
    .join("\n");
}

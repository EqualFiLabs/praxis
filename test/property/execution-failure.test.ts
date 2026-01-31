import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { createAgentLoop } from "../../src/agent/loop";
import type { AgentLoopDeps } from "../../src/agent/loop";
import type { ActionPlan } from "../../src/types/execution";
import type { Memory } from "../../src/types/memory";

const planArb = fc.record({
  actions: fc.array(
    fc.record({
      selector: fc.constant("0x12345678"),
      target: fc.constant("0x0000000000000000000000000000000000000000"),
      calldata: fc.constant("0x"),
      description: fc.string({ minLength: 1, maxLength: 16 })
    }),
    { minLength: 1, maxLength: 3 }
  ),
  reasoning: fc.string({ minLength: 1, maxLength: 32 })
}) as fc.Arbitrary<ActionPlan>;

describe("Property 19: Execution Failure Handling", () => {
  it("does not update memory when execution fails", async () => {
    await fc.assert(
      fc.asyncProperty(planArb, async (plan) => {
        let saved = 0;
        let transcriptErrors = 0;
        const memory: Memory = { constraints: [], preferences: [], raw: "" };

        const deps: AgentLoopDeps = {
          agentId: "agent-1",
          tbaAddress: "0x0000000000000000000000000000000000000000",
          loadMemory: async () => memory,
          saveMemory: async () => {
            saved += 1;
          },
          loadConstraints: async () => [],
          inferPlan: async () => plan,
          allowedSelectors: async () => ["0x12345678"],
          hasGenericExec: async () => true,
          executeAction: async () => ({ error: "boom" }),
          appendTranscript: async (entry) => {
            if (entry.type === "error") transcriptErrors += 1;
          },
          appendDecision: async () => {
            throw new Error("should not append decision");
          }
        };

        const loop = createAgentLoop(deps);
        const report = await loop.intake({ type: "prompt", text: "do thing" });
        expect(report.success).toBe(false);
        expect(saved).toBe(0);
        expect(transcriptErrors).toBeGreaterThan(0);
      }),
      { numRuns: 25 }
    );
  });
});

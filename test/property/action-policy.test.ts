import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { evaluatePolicy } from "../../src/policies/actions";

describe("Property: action policy determinism", () => {
  it("returns the same decision for identical inputs", () => {
    const ruleArb = fc.record({
      allow: fc.array(fc.string(), { maxLength: 3 }),
      deny: fc.array(fc.string(), { maxLength: 3 }),
      defaultAction: fc.constantFrom("allow", "deny")
    });

    const policyArb = fc.record({
      global: ruleArb,
      agents: fc.dictionary(fc.string({ minLength: 1 }), ruleArb),
      channels: fc.dictionary(fc.string({ minLength: 1 }), ruleArb),
      users: fc.dictionary(fc.string({ minLength: 1 }), ruleArb),
      sessions: fc.dictionary(fc.string({ minLength: 1 }), ruleArb)
    });

    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        policyArb,
        (action, agentId, policy) => {
          const context = { agentId };
          const first = evaluatePolicy(action, context, policy);
          const second = evaluatePolicy(action, context, policy);
          expect(first).toEqual(second);
        }
      )
    );
  });
});

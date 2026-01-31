import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { checkAction } from "../../src/constraints/checker";
import type { Constraint } from "../../src/types/memory";
import type { PlannedAction } from "../../src/types/execution";

const baseActionArb = fc.record({
  selector: fc.constant("0x12345678"),
  target: fc.string({ minLength: 1, maxLength: 10 }),
  calldata: fc.constant("0x"),
  description: fc.string({ minLength: 1, maxLength: 10 })
}) as fc.Arbitrary<PlannedAction>;

const constraintTypes = [
  "allowedPools",
  "maxSlippage",
  "maxExposure",
  "timeWindow",
  "doNotTrade"
] as const;

describe("Property 15: Constraint Type Support", () => {
  it("returns results for each supported constraint type", () => {
    fc.assert(
      fc.property(baseActionArb, fc.constantFrom(...constraintTypes), (action, type) => {
        const constraint: Constraint = {
          type,
          enabled: true,
          value: type === "timeWindow" ? { start: Date.now() - 1_000, end: Date.now() + 1_000 } : []
        };
        const results = checkAction(action, [constraint]);
        expect(results.length).toBe(1);
        expect(results[0]?.constraint.type).toBe(type);
      })
    );
  });
});

describe("Property 16: Constraint Violation Handling", () => {
  it("returns passed=false when a constraint is violated", () => {
    fc.assert(
      fc.property(baseActionArb, (action) => {
        const constraint: Constraint = {
          type: "allowedPools",
          enabled: true,
          value: ["pool-1"]
        };
        const violatingAction: PlannedAction = {
          ...action,
          metadata: { poolId: "pool-2" }
        };
        const results = checkAction(violatingAction, [constraint]);
        expect(results[0]?.passed).toBe(false);
      })
    );
  });
});

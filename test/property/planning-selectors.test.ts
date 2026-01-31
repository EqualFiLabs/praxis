import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { extractSelectors } from "../../src/planning/plan";

describe("Property: selector extraction stability", () => {
  it("matches selectors from plan actions", () => {
    const hexCharArb = fc.constantFrom(
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "a",
      "b",
      "c",
      "d",
      "e",
      "f"
    );
    const selectorArb = fc.array(
      fc.array(hexCharArb, { minLength: 8, maxLength: 8 }).map((chars) => `0x${chars.join("")}`),
      { minLength: 1, maxLength: 5 }
    );

    fc.assert(
      fc.property(selectorArb, (selectors) => {
        const plan = {
          actions: selectors.map((selector, index) => ({
            selector,
            target: "0xabc",
            calldata: "0xdead",
            description: `action ${index}`
          })),
          reasoning: "because"
        };
        expect(extractSelectors(plan as any)).toEqual(selectors);
      })
    );
  });
});

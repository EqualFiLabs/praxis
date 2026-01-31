import { describe, expect, it } from "vitest";
import { parseActionPlan, extractSelectors } from "../../src/planning/plan";

describe("parseActionPlan", () => {
  it("parses plain JSON", () => {
    const plan = parseActionPlan(
      JSON.stringify({
        actions: [
          {
            selector: "0x12345678",
            target: "0xabc",
            calldata: "0xdeadbeef",
            description: "do thing"
          }
        ],
        reasoning: "because"
      })
    );
    expect(plan.actions.length).toBe(1);
  });

  it("parses fenced JSON", () => {
    const plan = parseActionPlan(
      [
        "```json",
        JSON.stringify({
          actions: [],
          reasoning: "no actions"
        }),
        "```"
      ].join("\n")
    );
    expect(plan.actions.length).toBe(0);
  });
});

describe("extractSelectors", () => {
  it("returns selectors in order", () => {
    const plan = parseActionPlan(
      JSON.stringify({
        actions: [
          {
            selector: "0x11111111",
            target: "0xabc",
            calldata: "0xaaa",
            description: "one"
          },
          {
            selector: "0x22222222",
            target: "0xdef",
            calldata: "0xbbb",
            description: "two"
          }
        ],
        reasoning: "because"
      })
    );
    expect(extractSelectors(plan)).toEqual(["0x11111111", "0x22222222"]);
  });
});

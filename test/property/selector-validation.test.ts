import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  isSelectorAllowed,
  requireSelectorAllowed,
  buildCalldata,
  requireGenericExecForExternalTarget
} from "../../src/chain/selector-validation";

const hexCharArb = fc.constantFrom(..."0123456789abcdef".split(""));
const selectorArb = fc
  .array(hexCharArb, { minLength: 8, maxLength: 8 })
  .map((chars) => `0x${chars.join("")}`);

const addressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join("")}`);

describe("Property 13: Selector Validation Against Modules", () => {
  it("returns true when selector is in allowed list", () => {
    fc.assert(
      fc.property(selectorArb, (selector) => {
        expect(isSelectorAllowed([selector], selector)).toBe(true);
      })
    );
  });
});

describe("Property 14: Missing Module Error Handling", () => {
  it("throws with selector in message when missing", () => {
    fc.assert(
      fc.property(selectorArb, (selector) => {
        expect(() => requireSelectorAllowed([], selector)).toThrow(
          new RegExp(selector.replace("0x", ""))
        );
      })
    );
  });
});

describe("Property 17: Calldata Encoding", () => {
  it("prefixes selector and preserves even-length hex", () => {
    fc.assert(
      fc.property(selectorArb, fc.array(hexCharArb, { minLength: 0, maxLength: 64 }), (selector, data) => {
        const payload = data.join("");
        const calldata = buildCalldata(selector, `0x${payload}` as `0x${string}`);
        expect(calldata.startsWith(selector)).toBe(true);
        expect(calldata.length % 2).toBe(0);
      })
    );
  });
});

describe("Property 24: External Target Requires Generic Exec Module", () => {
  it("throws when target is external and generic exec is missing", () => {
    fc.assert(
      fc.property(addressArb, addressArb, (tba, target) => {
        fc.pre(tba.toLowerCase() !== target.toLowerCase());
        expect(() =>
          requireGenericExecForExternalTarget({
            tbaAddress: tba as `0x${string}`,
            target: target as `0x${string}`,
            hasGenericExec: false
          })
        ).toThrow();
      })
    );
  });
});

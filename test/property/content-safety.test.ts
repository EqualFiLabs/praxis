import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { sanitizeTaggedContent } from "../../src/safety/content";

describe("Property: sanitizeTaggedContent idempotent", () => {
  it("produces the same output when applied twice", () => {
    const entryArb = fc.record({
      content: fc.string(),
      tags: fc.array(fc.constantFrom("trusted", "untrusted", "external", "web", "oracle")),
      source: fc.option(fc.string(), { nil: undefined })
    });

    fc.assert(
      fc.property(fc.array(entryArb, { minLength: 0, maxLength: 10 }), (entries) => {
        const once = sanitizeTaggedContent(entries);
        const twice = sanitizeTaggedContent(once);
        expect(twice).toEqual(once);
      })
    );
  });
});

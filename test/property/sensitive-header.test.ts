import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { parseSensitiveSections } from "../../src/memory/sensitive";

describe("Property 8a: Sensitive Header Detection", () => {
  it("detects sections with [SENSITIVE] headers", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 32 }), (content) => {
        const raw = `# Intro\n${content}\n\n## [SENSITIVE] Secrets\nsecret text`;
        const sections = parseSensitiveSections(raw);
        expect(sections.length).toBeGreaterThan(0);
        expect(sections[0]?.header.includes("[SENSITIVE]")).toBe(true);
      })
    );
  });
});

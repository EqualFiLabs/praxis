import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  selectProvider,
  enforceContextLimit,
  estimateTokenCount,
  filterMemoryForInference
} from "../../src/inference/manager";
import type { ProviderConfig } from "../../src/types/config";

const providerConfigArb = (type: "ollama" | "external") =>
  fc.record({
    type: fc.constant(type),
    baseUrl: fc.string({ minLength: 1 }),
    model: fc.string({ minLength: 1 }),
    contextWindow: fc.integer({ min: 1, max: 4096 }),
    maxOutputTokens: fc.integer({ min: 1, max: 2048 }),
    timeoutMs: fc.integer({ min: 1, max: 120_000 })
  }) as fc.Arbitrary<ProviderConfig>;

const messageArb = fc.record({
  role: fc.constantFrom("system", "user", "assistant"),
  content: fc.string({ minLength: 1, maxLength: 256 })
});

describe("Property 1: Default Provider Selection", () => {
  it("selects ollama when no explicit provider is set", () => {
    fc.assert(
      fc.property(providerConfigArb("ollama"), (ollama) => {
        const selection = selectProvider(
          { providers: { ollama } },
          { ollama: true, external: false }
        );
        expect(selection?.id).toBe("ollama");
      })
    );
  });
});

describe("Property 2: Provider Fallback Logic", () => {
  it("falls back to external when ollama unavailable and allowed", () => {
    fc.assert(
      fc.property(providerConfigArb("external"), (external) => {
        const selection = selectProvider(
          {
            inference: { provider: "ollama", privacy: { allowExternal: true, allowSensitiveMemory: false } },
            providers: { external }
          },
          { ollama: false, external: true }
        );
        expect(selection?.id).toBe("external");
      })
    );
  });
});

describe("Property 4: Context Window Enforcement", () => {
  it("throws when estimated tokens exceed context window", () => {
    fc.assert(
      fc.property(messageArb, providerConfigArb("ollama"), (message, provider) => {
        const inflatedMessage = {
          ...message,
          content: "x".repeat(provider.contextWindow * 5)
        };
        const messages = [inflatedMessage];
        const estimated = estimateTokenCount(messages);
        expect(estimated).toBeGreaterThan(provider.contextWindow);
        expect(() => enforceContextLimit(messages, provider)).toThrow();
      })
    );
  });
});

describe("Property 3: Sensitive Memory Filtering", () => {
  it("strips [SENSITIVE] sections when allowSensitiveMemory is false", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 64 }), (content) => {
        const raw = `## Public\n${content}\n\n## [SENSITIVE] Secrets\nshould-not-leak`;
        const filtered = filterMemoryForInference(raw, false);
        expect(filtered).toContain("Public");
        expect(filtered).not.toContain("should-not-leak");
      })
    );
  });
});

describe("Property 6: External Inference Opt-In", () => {
  it("does not select external when allowExternal is false", () => {
    fc.assert(
      fc.property(providerConfigArb("external"), (external) => {
        const selection = selectProvider(
          {
            inference: { provider: "external", privacy: { allowExternal: false, allowSensitiveMemory: false } },
            providers: { external }
          },
          { ollama: false, external: true }
        );
        expect(selection).toBeNull();
      })
    );
  });
});

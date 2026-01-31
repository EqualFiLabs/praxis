import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { ProviderConfigSchema } from "../../src/types/config";

const adapterArb = fc.record({
  baseUrl: fc.string({ minLength: 1 }),
  apiKeyEnv: fc.string({ minLength: 1 }),
  model: fc.string({ minLength: 1 })
});

const providerConfigWithAdaptersArb = fc.record({
  type: fc.constant("external"),
  baseUrl: fc.string({ minLength: 1 }),
  model: fc.string({ minLength: 1 }),
  contextWindow: fc.integer({ min: 1, max: 1_000_000 }),
  maxOutputTokens: fc.integer({ min: 1, max: 1_000_000 }),
  timeoutMs: fc.integer({ min: 1, max: 120_000 }),
  apiKeyEnv: fc.string({ minLength: 1 }),
  adapters: fc.record({
    anthropic: fc.option(adapterArb, { nil: undefined }),
    google: fc.option(adapterArb, { nil: undefined })
  })
});

describe("Property 5a: Provider Adapter Config Validation", () => {
  it("accepts valid adapter configs", () => {
    fc.assert(
      fc.property(providerConfigWithAdaptersArb, (cfg) => {
        expect(ProviderConfigSchema.safeParse(cfg).success).toBe(true);
      })
    );
  });

  it("rejects adapter configs missing required fields", () => {
    fc.assert(
      fc.property(providerConfigWithAdaptersArb, (cfg) => {
        const bad = structuredClone(cfg) as Record<string, unknown>;
        const adapters = bad.adapters as Record<string, unknown> | undefined;
        if (!adapters) return;
        if (adapters.anthropic && typeof adapters.anthropic === "object") {
          const broken = { ...(adapters.anthropic as Record<string, unknown>) };
          delete broken.model;
          adapters.anthropic = broken;
        } else if (adapters.google && typeof adapters.google === "object") {
          const broken = { ...(adapters.google as Record<string, unknown>) };
          delete broken.apiKeyEnv;
          adapters.google = broken;
        } else {
          return;
        }
        bad.adapters = adapters;
        expect(ProviderConfigSchema.safeParse(bad).success).toBe(false);
      })
    );
  });
});

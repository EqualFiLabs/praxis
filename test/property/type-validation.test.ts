import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { ProviderConfigSchema } from "../../src/types/config";
import { SessionsFileSchema } from "../../src/types/session";
import { PlannedActionSchema, ActionPlanSchema } from "../../src/types/execution";

const providerConfigArb = fc.record({
  type: fc.constantFrom("ollama", "external"),
  baseUrl: fc.string({ minLength: 1 }),
  model: fc.string({ minLength: 1 }),
  contextWindow: fc.integer({ min: 1, max: 1_000_000 }),
  maxOutputTokens: fc.integer({ min: 1, max: 1_000_000 }),
  timeoutMs: fc.integer({ min: 1, max: 120_000 }),
  apiKeyEnv: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
  adapters: fc.option(
    fc.record({
      anthropic: fc.option(
        fc.record({
          baseUrl: fc.string({ minLength: 1 }),
          apiKeyEnv: fc.string({ minLength: 1 }),
          model: fc.string({ minLength: 1 })
        }),
        { nil: undefined }
      ),
      google: fc.option(
        fc.record({
          baseUrl: fc.string({ minLength: 1 }),
          apiKeyEnv: fc.string({ minLength: 1 }),
          model: fc.string({ minLength: 1 })
        }),
        { nil: undefined }
      )
    }),
    { nil: undefined }
  )
});

const sessionRecordArb = fc.record({
  sessionId: fc.string({ minLength: 1 }),
  agentId: fc.string({ minLength: 1 }),
  updatedAt: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
  lastChain: fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER })
});

const sessionsFileArb = fc.dictionary(fc.string({ minLength: 1 }), sessionRecordArb);

const validSelectorArb = fc.hexaString({ minLength: 8, maxLength: 8 }).map((hex) => `0x${hex}`);
const invalidSelectorArb = fc
  .string({ minLength: 1 })
  .filter((value) => !/^0x[0-9a-fA-F]{8}$/.test(value));

const plannedActionArb = fc.record({
  selector: validSelectorArb,
  target: fc.string({ minLength: 1 }),
  calldata: fc.string({ minLength: 1 }),
  description: fc.string({ minLength: 1 })
});

const actionPlanArb = fc.record({
  actions: fc.array(plannedActionArb, { minLength: 1, maxLength: 5 }),
  reasoning: fc.string({ minLength: 1 })
});

describe("Property 5: Provider Config Schema Validation", () => {
  it("accepts valid provider configs", () => {
    fc.assert(
      fc.property(providerConfigArb, (cfg) => {
        expect(ProviderConfigSchema.safeParse(cfg).success).toBe(true);
      })
    );
  });

  it("rejects provider configs missing required fields", () => {
    fc.assert(
      fc.property(providerConfigArb, (cfg) => {
        const missing = { ...cfg } as Record<string, unknown>;
        delete missing.model;
        expect(ProviderConfigSchema.safeParse(missing).success).toBe(false);
      })
    );
  });
});

describe("Property 10: Session Schema Validation", () => {
  it("accepts valid sessions files", () => {
    fc.assert(
      fc.property(sessionsFileArb, (file) => {
        expect(SessionsFileSchema.safeParse(file).success).toBe(true);
      })
    );
  });

  it("rejects session entries missing required fields", () => {
    fc.assert(
      fc.property(sessionsFileArb, (file) => {
        const entries = Object.entries(file);
        if (entries.length === 0) return;
        const [key, value] = entries[0];
        const badEntry = { ...value } as Record<string, unknown>;
        delete badEntry.sessionId;
        const badFile = { ...file, [key]: badEntry };
        expect(SessionsFileSchema.safeParse(badFile).success).toBe(false);
      })
    );
  });
});

describe("Property 12: Action Plan Selector Requirement", () => {
  it("accepts planned actions with valid selectors", () => {
    fc.assert(
      fc.property(plannedActionArb, (action) => {
        expect(PlannedActionSchema.safeParse(action).success).toBe(true);
      })
    );
  });

  it("rejects planned actions with invalid selectors", () => {
    fc.assert(
      fc.property(invalidSelectorArb, plannedActionArb, (selector, action) => {
        const badAction = { ...action, selector };
        expect(PlannedActionSchema.safeParse(badAction).success).toBe(false);
      })
    );
  });

  it("accepts action plans with valid actions", () => {
    fc.assert(
      fc.property(actionPlanArb, (plan) => {
        expect(ActionPlanSchema.safeParse(plan).success).toBe(true);
      })
    );
  });
});

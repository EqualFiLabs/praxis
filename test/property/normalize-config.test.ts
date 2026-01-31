import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { normalizeConfig } from "../../src/config/normalized";
import { validateConfig } from "../../src/config/loader";

const envNameArb = fc
  .tuple(
    fc.constantFrom(...("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as string[])),
    fc.array(
      fc.constantFrom(...("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_".split("") as string[])),
      { minLength: 0, maxLength: 10 }
    )
  )
  .map(([first, rest]) => first + rest.join(""));

describe("Property: normalizeConfig round-trip", () => {
  it("produces config still valid against schema", () => {
    fc.assert(
      fc.property(envNameArb, envNameArb, fc.constantFrom("ollama", "external"), (ownerKeyEnv, agentId, provider) => {
        const config = {
          agent: { id: agentId, profile: "default" },
          auth: { ownerKeyEnv },
          inference: {
            provider,
            privacy: { allowExternal: false, allowSensitiveMemory: false }
          },
          providers: {
            ollama: {
              type: "ollama",
              baseUrl: "http://localhost",
              model: "llama3",
              contextWindow: 1000,
              maxOutputTokens: 100,
              timeoutMs: 1000
            },
            external: {
              type: "external",
              baseUrl: "http://localhost",
              model: "gpt",
              contextWindow: 1000,
              maxOutputTokens: 100,
              timeoutMs: 1000,
              apiKeyEnv: "OPENAI_API_KEY"
            }
          },
          chain: {
            rpcUrl: "http://localhost",
            chainId: 1,
            tbaAddress: "0x123",
            positionNftAddress: "0x456",
            positionTokenId: "1"
          }
        };
        const normalized = normalizeConfig(config as any);
        expect(() => validateConfig(normalized as any)).not.toThrow();
      })
    );
  });
});

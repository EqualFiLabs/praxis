import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "../../src/policies/actions";

describe("evaluatePolicy", () => {
  it("respects deny list", () => {
    const decision = evaluatePolicy(
      "trade",
      { agentId: "agent" },
      { global: { deny: ["trade"] } }
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("deny-list");
  });

  it("respects allow list", () => {
    const decision = evaluatePolicy(
      "trade",
      { agentId: "agent" },
      { global: { allow: ["trade"] } }
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allow-list");
  });

  it("defaults to deny when allow list exists and action missing", () => {
    const decision = evaluatePolicy(
      "other",
      { agentId: "agent" },
      { global: { allow: ["trade"] } }
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("not-in-allow-list");
  });

  it("uses scoped rules before global", () => {
    const decision = evaluatePolicy(
      "trade",
      { agentId: "agent", channelId: "telegram" },
      { global: { deny: ["trade"] }, channels: { telegram: { allow: ["trade"] } } }
    );
    expect(decision.allowed).toBe(true);
  });
});

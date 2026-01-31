import { describe, expect, it } from "vitest";
import { requestWhatsAppOnboarding } from "../../src/channels/onboarding/whatsapp";

describe("requestWhatsAppOnboarding", () => {
  it("allows sender when allowlist is empty", () => {
    const result = requestWhatsAppOnboarding(
      { enabled: true, sessionDir: "phone" },
      "+1555"
    );
    expect(result.allowed).toBe(true);
  });

  it("rejects sender when not in allowlist", () => {
    const result = requestWhatsAppOnboarding(
      { enabled: true, sessionDir: "phone", allowFrom: ["+1999"] },
      "+1555"
    );
    expect(result.allowed).toBe(false);
  });
});

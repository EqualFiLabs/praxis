import { describe, expect, it } from "vitest";
import { BaseError, ProviderError, SystemError, UserError, classifyError } from "../../src/errors";

describe("error taxonomy", () => {
  it("classifies BaseError instances without wrapping", () => {
    const err = new ProviderError("boom");
    const classified = classifyError(err);
    expect(classified).toBe(err);
    expect(classified.category).toBe("provider");
  });

  it("wraps unknown errors as SystemError", () => {
    const classified = classifyError(new Error("oops"));
    expect(classified).toBeInstanceOf(SystemError);
    expect(classified.category).toBe("system");
  });

  it("supports UserError formatting", () => {
    const err = new UserError("bad input");
    expect(err.category).toBe("user");
  });
});

import { describe, expect, it } from "vitest";
import { sanitizeTaggedContent } from "../../src/safety/content";

describe("sanitizeTaggedContent", () => {
  it("strips entries with unsafe tags by default", () => {
    const result = sanitizeTaggedContent([
      { content: "trusted", tags: ["trusted"] },
      { content: "web", tags: ["web"] },
      { content: "oracle", tags: ["oracle"] }
    ]);
    expect(result.map((entry) => entry.content)).toEqual(["trusted", "oracle"]);
  });

  it("allows sources on allowlist even if tagged", () => {
    const result = sanitizeTaggedContent(
      [
        { content: "web", tags: ["web"], source: "news" },
        { content: "other", tags: ["web"], source: "other" }
      ],
      { allowSources: ["news"] }
    );
    expect(result.map((entry) => entry.source)).toEqual(["news"]);
  });
});

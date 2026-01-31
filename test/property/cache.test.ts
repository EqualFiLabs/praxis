import { describe, it, expect, vi, afterEach } from "vitest";
import fc from "fast-check";

import { fetchWithCache, markStale, clearCache } from "../../src/data/cache";

describe("Property 20: Cache TTL Behavior", () => {
  afterEach(() => {
    clearCache();
  });

  it("returns cached data within TTL", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 8 }), async (key) => {
        clearCache();
        let calls = 0;
        const fetcher = async () => {
          calls += 1;
          return "value";
        };
        const first = await fetchWithCache(key, fetcher, 10_000);
        const second = await fetchWithCache(key, fetcher, 10_000);
        expect(first.data).toBe("value");
        expect(second.data).toBe("value");
        expect(calls).toBe(1);
      })
    );
  });
});

describe("Property 21: Data Timestamp Attachment", () => {
  afterEach(() => {
    clearCache();
  });

  it("attaches a timestamp to cached data", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 8 }), async (key) => {
        const result = await fetchWithCache(key, async () => "value", 10_000);
        expect(typeof result.timestamp).toBe("number");
        expect(result.timestamp).toBeGreaterThan(0);
      })
    );
  });
});

describe("Property 22: Stale Data Indication", () => {
  afterEach(() => {
    clearCache();
    vi.restoreAllMocks();
  });

  it("marks data as stale when TTL exceeded", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 8 }), async (key) => {
        const now = Date.now();
        vi.spyOn(Date, "now").mockReturnValue(now);
        const result = await fetchWithCache(key, async () => "value", 1_000);
        const later = markStale(result, 1_000);
        vi.spyOn(Date, "now").mockReturnValue(now + 2_000);
        const stale = markStale(result, 1_000);
        expect(later.stale).toBe(false);
        expect(stale.stale).toBe(true);
      })
    );
  });
});

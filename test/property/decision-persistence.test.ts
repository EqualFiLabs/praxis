import { describe, it, expect, vi, afterEach } from "vitest";
import fc from "fast-check";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { appendDecision } from "../../src/memory/store";

const decisionArb = fc.record({
  id: fc.uuid(),
  timestamp: fc.integer({ min: 1_600_000_000_000, max: 2_000_000_000_000 }),
  action: fc.string({ minLength: 1, maxLength: 32 }),
  rationale: fc.string({ minLength: 1, maxLength: 64 }),
  outcome: fc.option(fc.string({ minLength: 1, maxLength: 32 }), { nil: undefined }),
  txHash: fc.option(fc.string({ minLength: 1, maxLength: 66 }), { nil: undefined })
});

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : "decision";
}

describe("Property 9: Decision File Persistence", () => {
  const originalHomedir = os.homedir;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes decisions to memory/decisions/YYYY-MM-DD-<action>.md", async () => {
    await fc.assert(
      fc.asyncProperty(decisionArb, async (decision) => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "praxis-decision-"));
        vi.spyOn(os, "homedir").mockReturnValue(tmp);

        const agentId = "agent-1";
        const filePath = await appendDecision(agentId, decision);
        const expectedDate = formatDate(decision.timestamp);
        const expectedSlug = slugify(decision.action);
        const expectedPath = path.join(
          tmp,
          ".equalis",
          "agents",
          agentId,
          "memory",
          "decisions",
          `${expectedDate}-${expectedSlug}.md`
        );

        expect(filePath).toBe(expectedPath);
        const content = await fs.readFile(expectedPath, "utf-8");
        expect(content).toContain(decision.action);
      }),
      { numRuns: 25 }
    );
  });
});

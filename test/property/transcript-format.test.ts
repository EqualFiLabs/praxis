import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import fc from "fast-check";

import { append, loadTranscript, logAction } from "../../src/session/transcript";

const entryArb = fc.record({
  type: fc.constantFrom("message", "action", "error", "system"),
  role: fc.option(fc.constantFrom("user", "assistant", "system"), { nil: undefined }),
  text: fc.string({ minLength: 1, maxLength: 64 }),
  timestamp: fc.integer({ min: 1_600_000_000_000, max: 2_000_000_000_000 }),
  metadata: fc.option(fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), fc.string()), {
    nil: undefined
  })
});

describe("Property 11/23: Transcript Format and JSONL", () => {
  const originalHomedir = os.homedir;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes JSONL entries and can reload them", async () => {
    await fc.assert(
      fc.asyncProperty(entryArb, async (entry) => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "praxis-transcript-"));
        vi.spyOn(os, "homedir").mockReturnValue(tmp);
        const agentId = "agent-1";
        const sessionId = "session-1";

        await append(agentId, sessionId, entry);
        const loaded = await loadTranscript(agentId, sessionId);
        expect(loaded.length).toBe(1);
        expect(loaded[0]).toEqual(entry);
      }),
      { numRuns: 25 }
    );
  });
});

describe("Property 18: Action Logging", () => {
  const originalHomedir = os.homedir;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("appends action log entries with selector and txHash", async () => {
    await fc.assert(
      fc.asyncProperty(entryArb, async (entry) => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "praxis-actionlog-"));
        vi.spyOn(os, "homedir").mockReturnValue(tmp);
        const agentId = "agent-1";
        const actionEntry = {
          ...entry,
          type: "action" as const,
          metadata: {
            selector: "0x12345678",
            txHash: "0x" + "1".repeat(64)
          }
        };

        await logAction(agentId, actionEntry);
        const logPath = path.join(tmp, ".equalis", "agents", agentId, "logs", "agent-actions.jsonl");
        const raw = await fs.readFile(logPath, "utf-8");
        const lines = raw.trim().split("\n");
        expect(lines.length).toBe(1);
        const parsed = JSON.parse(lines[0] as string);
        expect(parsed.metadata.selector).toBe("0x12345678");
        expect(parsed.metadata.txHash).toBe("0x" + "1".repeat(64));
      }),
      { numRuns: 25 }
    );
  });
});

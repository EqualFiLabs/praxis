import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { createTelemetryLogger } from "../../src/telemetry/logger";

describe("telemetry logger", () => {
  const originalHome = process.env.HOME;
  const originalEqualisHome = process.env.EQUALIS_HOME;
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "praxis-telemetry-"));
    process.env.HOME = tempDir;
    process.env.EQUALIS_HOME = tempDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    process.env.EQUALIS_HOME = originalEqualisHome;
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes telemetry jsonl entries", async () => {
    const logger = createTelemetryLogger("agent");
    await logger.log({
      type: "plan",
      timestamp: new Date().toISOString(),
      agentId: "agent",
      metadata: { actions: 1 }
    });
    const logPath = path.join(
      tempDir,
      ".equalis",
      "agents",
      "agent",
      "logs",
      "telemetry.jsonl"
    );
    const content = await fs.readFile(logPath, "utf8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.type).toBe("plan");
  });
});

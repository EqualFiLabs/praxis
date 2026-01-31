import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { appendChannelEvent } from "../../src/channels/observability";

describe("appendChannelEvent", () => {
  const originalHome = process.env.HOME;
  const originalEqualisHome = process.env.EQUALIS_HOME;
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "praxis-home-"));
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

  it("writes a JSONL entry under the agent logs directory", async () => {
    await appendChannelEvent("agent", {
      type: "message",
      channelId: "telegram",
      timestamp: new Date().toISOString(),
      direction: "inbound"
    });
    const logPath = path.join(tempDir, ".equalis", "agents", "agent", "logs", "channel-events.jsonl");
    const content = await fs.readFile(logPath, "utf8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.channelId).toBe("telegram");
    expect(parsed.type).toBe("message");
  });
});

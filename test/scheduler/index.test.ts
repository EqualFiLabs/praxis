import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { runDueJobs, schedule, type ScheduledJob } from "../../src/scheduler";

describe("scheduler", () => {
  const originalHome = process.env.HOME;
  const originalEqualisHome = process.env.EQUALIS_HOME;
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "praxis-sched-"));
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

  it("runs due jobs and retries on failure", async () => {
    const agentId = "agent";
    const job: ScheduledJob = {
      id: "job1",
      agentId,
      runAt: Date.now() - 1000,
      payload: {},
      attempts: 0,
      maxAttempts: 2
    };
    await schedule(job);
    let failOnce = true;
    const now = Date.now();
    const result1 = await runDueJobs(agentId, async () => {
      if (failOnce) {
        failOnce = false;
        throw new Error("boom");
      }
    }, now);
    expect(result1.failed).toBe(1);

    const result2 = await runDueJobs(agentId, async () => {}, now + 61_000);
    expect(result2.ran).toBe(1);
  });
});

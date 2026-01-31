import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { prunePath } from "../../src/retention/cleanup";

describe("retention cleanup", () => {
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "praxis-retention-"));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("removes files older than cutoff", async () => {
    const oldFile = path.join(tempDir, "old.log");
    const freshFile = path.join(tempDir, "fresh.log");
    await fs.writeFile(oldFile, "old");
    await fs.writeFile(freshFile, "fresh");
    const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000;
    await fs.utimes(oldFile, oldTime / 1000, oldTime / 1000);

    const result = await prunePath(tempDir, 5);
    expect(result.removed).toBe(1);
    const files = await fs.readdir(tempDir);
    expect(files).toContain("fresh.log");
    expect(files).not.toContain("old.log");
  });
});

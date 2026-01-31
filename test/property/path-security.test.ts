import { describe, it, expect } from "vitest";
import fc from "fast-check";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { resolveSafePath } from "../../src/utils/path-security";

const nameArb = fc
  .string({ minLength: 1, maxLength: 8 })
  .filter((value) => !value.includes(path.sep) && !value.includes(".."));

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("Property 8: Symlink Escape Prevention", () => {
  it("rejects paths that escape base via symlinks", async () => {
    await fc.assert(
      fc.asyncProperty(nameArb, async (name) => {
        const base = await createTempDir("praxis-base-");
        const outside = await createTempDir("praxis-out-");
        const linkPath = path.join(base, "link");
        await fs.symlink(outside, linkPath);

        expect(() => resolveSafePath(base, path.join("link", name))).toThrow();
      }),
      { numRuns: 25 }
    );
  });
});

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import os from "node:os";
import path from "node:path";

import { getAgentBasePath } from "../../src/config/loader";

const agentIdArb = fc
  .string({ minLength: 1, maxLength: 32 })
  .filter((value) => value.trim().length > 0)
  .filter((value) => !value.includes(path.sep) && !value.includes(".."));

describe("Property 7: Agent Storage Path Construction", () => {
  it("roots storage paths under ~/.equalis/agents/<agentId>", () => {
    fc.assert(
      fc.property(agentIdArb, (agentId) => {
        const base = getAgentBasePath(agentId);
        const expected = path.join(os.homedir(), ".equalis", "agents", agentId.trim());
        expect(base).toBe(expected);
      })
    );
  });
});

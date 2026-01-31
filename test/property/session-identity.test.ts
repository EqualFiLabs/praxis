import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildSessionKey } from "../../src/session/identity";

describe("Property: session key determinism", () => {
  it("returns same key for identical inputs", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.constantFrom("dm", "group", "thread"),
        (agentId, userId, chatType) => {
          const key1 = buildSessionKey({
            agentId,
            userId,
            channelId: "telegram",
            chatType,
            threadId: chatType === "thread" ? "t1" : undefined
          });
          const key2 = buildSessionKey({
            agentId,
            userId,
            channelId: "telegram",
            chatType,
            threadId: chatType === "thread" ? "t1" : undefined
          });
          expect(key1).toBe(key2);
        }
      )
    );
  });
});

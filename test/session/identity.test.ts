import { describe, expect, it } from "vitest";
import { buildSessionKey, resolveSessionScope } from "../../src/session/identity";
import type { MsgContext } from "../../src/channels/types";

describe("session identity", () => {
  it("builds distinct keys for dm/group/thread", () => {
    const base = {
      agentId: "agent",
      userId: "alice",
      channelId: "telegram"
    };
    const dm = buildSessionKey({ ...base, chatType: "dm" });
    const group = buildSessionKey({ ...base, chatType: "group" });
    const thread = buildSessionKey({ ...base, chatType: "thread", threadId: "t1" });
    expect(dm).not.toEqual(group);
    expect(group).not.toEqual(thread);
  });

  it("resolves session scope from message", () => {
    const msg: MsgContext = {
      channelId: "discord",
      userId: "alice",
      timestamp: new Date().toISOString(),
      content: "hi",
      sessionKey: "unused",
      chatType: "dm"
    };
    const scope = resolveSessionScope("agent", msg);
    expect(scope.agentId).toBe("agent");
    expect(scope.channelId).toBe("discord");
    expect(scope.chatType).toBe("dm");
  });
});

import { describe, expect, it } from "vitest";
import { isActionAllowed } from "../../src/channels/policies/actions";
import type { MsgContext } from "../../src/channels/types";

const baseContext: MsgContext = {
  channelId: "telegram",
  userId: "alice",
  timestamp: new Date().toISOString(),
  content: "hi",
  sessionKey: "channel:telegram:dm:alice",
  chatType: "dm"
};

describe("action policy", () => {
  it("allows action when no policy set", () => {
    expect(isActionAllowed("trade", baseContext)).toBe(true);
  });

  it("denies action when in deny list", () => {
    expect(
      isActionAllowed("trade", baseContext, { deny: ["trade"] })
    ).toBe(false);
  });

  it("enforces allow list when provided", () => {
    expect(
      isActionAllowed("trade", baseContext, { allow: ["status"] })
    ).toBe(false);
    expect(
      isActionAllowed("status", baseContext, { allow: ["status"] })
    ).toBe(true);
  });

  it("can disallow group actions", () => {
    const groupCtx: MsgContext = { ...baseContext, chatType: "group" };
    expect(
      isActionAllowed("trade", groupCtx, { allowInGroups: false })
    ).toBe(false);
  });
});

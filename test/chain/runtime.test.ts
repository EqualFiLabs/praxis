import { describe, expect, it, vi } from "vitest";
import type { AgentConfig } from "../../src/types/config";
import type { PublicClient, WalletClient } from "viem";
import { createChainRuntime } from "../../src/chain/runtime";

const baseConfig: AgentConfig = {
  agent: { id: "agent", profile: "test" },
  auth: { ownerKeyEnv: "OWNER_KEY" },
  inference: {
    provider: "ollama",
    privacy: { allowExternal: false, allowSensitiveMemory: false }
  },
  providers: {},
  chain: {
    rpcUrl: "http://localhost",
    chainId: 1,
    tbaAddress: "0x0000000000000000000000000000000000000123",
    positionNftAddress: "0x0000000000000000000000000000000000000456",
    positionTokenId: "1"
  }
};

describe("createChainRuntime", () => {
  it("flattens installed module selectors for allowedSelectors", async () => {
    const readContract = vi.fn().mockImplementation(({ functionName, args }) => {
      if (functionName === "getInstalledExecutionModules") {
        return [
          "0x0000000000000000000000000000000000000aaa",
          "0x0000000000000000000000000000000000000bbb"
        ];
      }
      if (functionName === "getExecutionSelectors") {
        if (args?.[0] === "0x0000000000000000000000000000000000000aaa") {
          return ["0x11111111"];
        }
        return ["0x22222222", "0x33333333"];
      }
      return [];
    });
    const publicClient = { readContract } as unknown as PublicClient;
    const walletClient = { writeContract: vi.fn() } as unknown as WalletClient;

    const runtime = createChainRuntime({ config: baseConfig, publicClient, walletClient });
    const selectors = await runtime.allowedSelectors();

    expect(selectors).toEqual(["0x11111111", "0x22222222", "0x33333333"]);
  });

  it("detects generic exec module installation", async () => {
    const readContract = vi.fn().mockImplementation(({ functionName }) => {
      if (functionName === "getInstalledExecutionModules") {
        return ["0x0000000000000000000000000000000000000abc"];
      }
      return [];
    });
    const publicClient = { readContract } as unknown as PublicClient;
    const walletClient = { writeContract: vi.fn() } as unknown as WalletClient;
    const config: AgentConfig = {
      ...baseConfig,
      chain: {
        ...baseConfig.chain,
        genericExecModule: "0x0000000000000000000000000000000000000abc"
      }
    };

    const runtime = createChainRuntime({ config, publicClient, walletClient });
    await expect(runtime.hasGenericExec()).resolves.toBe(true);
  });

  it("executes planned action through the TBA executor", async () => {
    const publicClient = { readContract: vi.fn() } as unknown as PublicClient;
    const writeContract = vi.fn().mockResolvedValue("0xtxhash");
    const walletClient = { writeContract } as unknown as WalletClient;
    const runtime = createChainRuntime({ config: baseConfig, publicClient, walletClient });

    const result = await runtime.executeAction({
      selector: "0x12345678",
      target: "0x0000000000000000000000000000000000000def",
      calldata: "0xdeadbeef",
      description: "call"
    });

    expect(result.txHash).toBe("0xtxhash");
    expect(writeContract).toHaveBeenCalledOnce();
    const call = writeContract.mock.calls[0][0];
    expect(call.args[2]).toBe("0x12345678deadbeef");
    expect(call.args[1]).toBe(0n);
  });

  it("surfaces execution errors", async () => {
    const publicClient = { readContract: vi.fn() } as unknown as PublicClient;
    const walletClient = {
      writeContract: vi.fn().mockRejectedValue(new Error("boom"))
    } as unknown as WalletClient;
    const runtime = createChainRuntime({ config: baseConfig, publicClient, walletClient });

    const result = await runtime.executeAction({
      selector: "0x12345678",
      target: "0x0000000000000000000000000000000000000def",
      calldata: "0xdeadbeef",
      description: "call"
    });

    expect(result.error).toMatch("boom");
  });
});

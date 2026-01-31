import type { Abi } from "viem";

export const TBA_MODULE_VIEW_ABI: Abi = [
  {
    type: "function",
    name: "getInstalledExecutionModules",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "modules", type: "address[]" }]
  },
  {
    type: "function",
    name: "getExecutionSelectors",
    stateMutability: "view",
    inputs: [{ name: "module", type: "address" }],
    outputs: [{ name: "selectors", type: "bytes4[]" }]
  },
  {
    type: "function",
    name: "isSelectorAllowed",
    stateMutability: "view",
    inputs: [{ name: "selector", type: "bytes4" }],
    outputs: [{ name: "allowed", type: "bool" }]
  }
];

export const ERC6551_EXECUTABLE_ABI: Abi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" }
    ],
    outputs: [{ name: "result", type: "bytes" }]
  }
];

/**
 * Deployed CZM contract addresses + minimal ABIs.
 * Currently wired to Base Sepolia testnet.
 *
 * Mainnet addresses can be added under `base` once deployed.
 */
import type { Address } from "viem";

export const CONTRACTS = {
  baseSepolia: {
    czmTokenV1: "0x5b4319dB4b2949E921400D850838508BB8a510CE" as Address,
    czmVesting: "0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79" as Address,
    czmTokenV2: "0xC51AC33D23f7cCff7ddF83b751C52AF8ff50057c" as Address,
    czmMigration: "0x1a3Fb22873fF0778069c7708A40E1CEA48Bb660c" as Address,
  },
  // base: { ... } // populated post-mainnet deploy
} as const;

// ===================== ABIs (minimal) =====================

export const CZMTokenAbi = [
  { type: "function", name: "name", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "totalSupply", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "allowance", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "approve", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "transfer", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "VERSION", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "cap", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "paused", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" },
] as const;

export const CZMVestingAbi = [
  {
    type: "function",
    name: "schedules",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "beneficiary", type: "address" },
      { name: "totalAmount", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "cliffDuration", type: "uint256" },
      { name: "vestingDuration", type: "uint256" },
      { name: "released", type: "uint256" },
      { name: "revocable", type: "bool" },
      { name: "revoked", type: "bool" },
    ],
    stateMutability: "view",
  },
  { type: "function", name: "scheduleIdsOf", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "releasable", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "release", inputs: [{ type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "releaseAll", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getScheduleCount", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

export const CZMMigrationAbi = [
  { type: "function", name: "migrate", inputs: [{ type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "totalMigrated", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "migratedBy", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "deadline", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "paused", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "closed", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "bonusBps", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

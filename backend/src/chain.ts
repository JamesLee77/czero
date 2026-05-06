import { createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import type { Env } from "./types";

export interface VestingSchedule {
  beneficiary: `0x${string}`;
  totalAmount: bigint;
  startTime: bigint;
  cliffDuration: bigint;
  vestingDuration: bigint;
  released: bigint;
  revocable: boolean;
  revoked: boolean;
}

const VESTING_ABI = parseAbi([
  "function getScheduleCount() view returns (uint256)",
  "function schedules(uint256) view returns (address beneficiary, uint256 totalAmount, uint256 startTime, uint256 cliffDuration, uint256 vestingDuration, uint256 released, bool revocable, bool revoked)",
  "function releasable(uint256) view returns (uint256)",
]);

function makeClient(env: Env) {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(env.RPC_URL),
  });
}

export async function readScheduleCount(env: Env): Promise<bigint> {
  const client = makeClient(env);
  return await client.readContract({
    address: env.CZM_VESTING_ADDRESS as `0x${string}`,
    abi: VESTING_ABI,
    functionName: "getScheduleCount",
  });
}

export async function readSchedule(env: Env, id: bigint): Promise<VestingSchedule> {
  const client = makeClient(env);
  const [beneficiary, totalAmount, startTime, cliffDuration, vestingDuration, released, revocable, revoked] =
    (await client.readContract({
      address: env.CZM_VESTING_ADDRESS as `0x${string}`,
      abi: VESTING_ABI,
      functionName: "schedules",
      args: [id],
    })) as readonly [`0x${string}`, bigint, bigint, bigint, bigint, bigint, boolean, boolean];
  return { beneficiary, totalAmount, startTime, cliffDuration, vestingDuration, released, revocable, revoked };
}

export async function readReleasable(env: Env, id: bigint): Promise<bigint> {
  const client = makeClient(env);
  return (await client.readContract({
    address: env.CZM_VESTING_ADDRESS as `0x${string}`,
    abi: VESTING_ABI,
    functionName: "releasable",
    args: [id],
  })) as bigint;
}

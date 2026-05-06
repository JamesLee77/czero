import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { CONTRACTS, CZMTokenAbi } from "../lib/contracts";
import { fmtCZM, shortAddress } from "../lib/format";

const v1 = CONTRACTS.baseSepolia.czmTokenV1;
const v2 = CONTRACTS.baseSepolia.czmTokenV2;

export default function Home() {
  const { address, isConnected } = useAccount();

  const { data: v1Info } = useReadContracts({
    contracts: [
      { address: v1, abi: CZMTokenAbi, functionName: "name" },
      { address: v1, abi: CZMTokenAbi, functionName: "symbol" },
      { address: v1, abi: CZMTokenAbi, functionName: "VERSION" },
      { address: v1, abi: CZMTokenAbi, functionName: "totalSupply" },
      { address: v1, abi: CZMTokenAbi, functionName: "cap" },
      { address: v1, abi: CZMTokenAbi, functionName: "paused" },
    ],
  });
  const { data: v2Info } = useReadContracts({
    contracts: [
      { address: v2, abi: CZMTokenAbi, functionName: "totalSupply" },
      { address: v2, abi: CZMTokenAbi, functionName: "VERSION" },
    ],
  });
  const { data: v1Bal } = useReadContract({
    address: v1, abi: CZMTokenAbi, functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: v2Bal } = useReadContract({
    address: v2, abi: CZMTokenAbi, functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold mb-2">C-ZERO Mining Token</h1>
        <p className="text-neutral-400">
          Pre-sale investor portal. Connect your wallet to view vesting schedules and migrate tokens between contract versions.
        </p>
      </section>

      {!isConnected && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 text-center">
          <p className="text-neutral-300">Connect your wallet to continue.</p>
        </div>
      )}

      {isConnected && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <h2 className="text-lg font-semibold mb-4">Your balances</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-neutral-400">Address</dt>
              <dd className="font-mono">{shortAddress(address)}</dd>
            </div>
            <div>
              <dt className="text-neutral-400">v1 CZM</dt>
              <dd className="text-xl font-semibold">{fmtCZM(v1Bal as bigint | undefined)}</dd>
            </div>
            <div>
              <dt className="text-neutral-400">v2 CZM</dt>
              <dd className="text-xl font-semibold">{fmtCZM(v2Bal as bigint | undefined)}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">CZM v1</h3>
            <span className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-300">
              {(v1Info?.[2]?.result as string | undefined) ?? "—"}
            </span>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-neutral-400">Name</dt><dd>{(v1Info?.[0]?.result as string | undefined) ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-400">Symbol</dt><dd>{(v1Info?.[1]?.result as string | undefined) ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-400">Total supply</dt><dd>{fmtCZM(v1Info?.[3]?.result as bigint | undefined)}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-400">Cap</dt><dd>{fmtCZM(v1Info?.[4]?.result as bigint | undefined, 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-400">Paused</dt><dd>{(v1Info?.[5]?.result as boolean | undefined) ? "yes" : "no"}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-400">Address</dt><dd className="font-mono text-xs">{shortAddress(v1)}</dd></div>
          </dl>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">CZM v2 (migration target)</h3>
            <span className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-300">
              {(v2Info?.[1]?.result as string | undefined) ?? "—"}
            </span>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-neutral-400">Total supply</dt><dd>{fmtCZM(v2Info?.[0]?.result as bigint | undefined)}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-400">Address</dt><dd className="font-mono text-xs">{shortAddress(v2)}</dd></div>
          </dl>
        </div>
      </section>
    </div>
  );
}

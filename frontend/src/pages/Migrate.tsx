import { useEffect, useMemo, useState } from "react";
import { maxUint256 } from "viem";
import {
  useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt,
} from "wagmi";
import { CONTRACTS, CZMTokenAbi, CZMMigrationAbi } from "../lib/contracts";
import { fmtCZM } from "../lib/format";

const v1 = CONTRACTS.baseSepolia.czmTokenV1;
const v2 = CONTRACTS.baseSepolia.czmTokenV2;
const mig = CONTRACTS.baseSepolia.czmMigration;

export default function Migrate() {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<"idle" | "approving" | "migrating">("idle");

  const { data: state } = useReadContracts({
    contracts: [
      { address: v1, abi: CZMTokenAbi, functionName: "balanceOf", args: address ? [address] : undefined },
      { address: v2, abi: CZMTokenAbi, functionName: "balanceOf", args: address ? [address] : undefined },
      { address: v1, abi: CZMTokenAbi, functionName: "allowance", args: address ? [address, mig] : undefined },
      { address: mig, abi: CZMMigrationAbi, functionName: "totalMigrated" },
      { address: mig, abi: CZMMigrationAbi, functionName: "deadline" },
      { address: mig, abi: CZMMigrationAbi, functionName: "paused" },
      { address: mig, abi: CZMMigrationAbi, functionName: "closed" },
      { address: mig, abi: CZMMigrationAbi, functionName: "bonusBps" },
    ],
    query: { enabled: !!address },
  });

  const v1Bal = state?.[0]?.result as bigint | undefined;
  const v2Bal = state?.[1]?.result as bigint | undefined;
  const allow = state?.[2]?.result as bigint | undefined;
  const totalMigrated = state?.[3]?.result as bigint | undefined;
  const deadline = state?.[4]?.result as bigint | undefined;
  const paused = state?.[5]?.result as boolean | undefined;
  const closed = state?.[6]?.result as boolean | undefined;
  const bonusBps = state?.[7]?.result as bigint | undefined;

  const { data: migratedByMe } = useReadContract({
    address: mig, abi: CZMMigrationAbi, functionName: "migratedBy",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const needsApproval = useMemo(() => {
    if (allow === undefined || v1Bal === undefined) return true;
    return allow < v1Bal;
  }, [allow, v1Bal]);

  const isExpired = deadline !== undefined && BigInt(Math.floor(Date.now() / 1000)) > deadline;
  const canMigrate =
    isConnected && !!v1Bal && v1Bal > 0n && !paused && !closed && !isExpired;

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isConfirmed) setStep("idle");
  }, [isConfirmed]);

  const onApprove = () => {
    if (!v1Bal) return;
    setStep("approving");
    writeContract({
      address: v1, abi: CZMTokenAbi, functionName: "approve", args: [mig, maxUint256],
    });
  };
  const onMigrate = () => {
    if (!v1Bal) return;
    setStep("migrating");
    writeContract({
      address: mig, abi: CZMMigrationAbi, functionName: "migrate", args: [v1Bal],
    });
  };

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 text-center">
        <p>Connect your wallet to migrate v1 → v2.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Migrate v1 → v2</h1>
        <p className="text-sm text-neutral-400">
          Burns your v1 CZM and mints the same amount of v2 CZM 1:1.
          {bonusBps !== undefined && bonusBps > 0n && (
            <span className="ml-2 text-green-400">
              + {(Number(bonusBps) / 100).toFixed(2)}% bonus
            </span>
          )}
        </p>
      </header>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <h2 className="font-semibold mb-3">Migration status</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-neutral-400">Your v1 balance</dt>
            <dd className="text-xl font-semibold">{fmtCZM(v1Bal)}</dd>
          </div>
          <div>
            <dt className="text-neutral-400">Your v2 balance</dt>
            <dd className="text-xl font-semibold">{fmtCZM(v2Bal)}</dd>
          </div>
          <div>
            <dt className="text-neutral-400">You've migrated (cumulative)</dt>
            <dd>{fmtCZM(migratedByMe as bigint | undefined)}</dd>
          </div>
          <div>
            <dt className="text-neutral-400">Total migrated (all)</dt>
            <dd>{fmtCZM(totalMigrated)}</dd>
          </div>
          <div>
            <dt className="text-neutral-400">Deadline</dt>
            <dd>{deadline ? new Date(Number(deadline) * 1000).toLocaleDateString() : "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-400">Status</dt>
            <dd>
              {closed ? <span className="text-red-400">Closed</span> :
               paused ? <span className="text-yellow-400">Paused</span> :
               isExpired ? <span className="text-red-400">Expired</span> :
               <span className="text-green-400">Open</span>}
            </dd>
          </div>
        </dl>
      </section>

      {v1Bal !== undefined && v1Bal === 0n ? (
        <div className="rounded-md border border-neutral-800 bg-neutral-900/50 p-6 text-center text-neutral-300">
          You have no v1 tokens to migrate.
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${needsApproval ? "bg-green-500 text-black" : "bg-neutral-700 text-neutral-400"}`}>1</span>
              <div className="flex-1">
                <div className="font-medium">Approve migration to spend your v1 CZM</div>
                <div className="text-neutral-500">Current allowance: {fmtCZM(allow)}</div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${!needsApproval ? "bg-green-500 text-black" : "bg-neutral-700 text-neutral-400"}`}>2</span>
              <div className="flex-1">
                <div className="font-medium">Migrate {fmtCZM(v1Bal)} v1 → v2</div>
                <div className="text-neutral-500">Burns v1 and mints v2 1:1.</div>
              </div>
            </li>
          </ol>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onApprove}
              disabled={!needsApproval || isPending || isConfirming}
              className="rounded-md bg-neutral-700 hover:bg-neutral-600 text-white font-semibold px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {step === "approving" && isPending ? "Awaiting wallet…" : "Approve"}
            </button>
            <button
              onClick={onMigrate}
              disabled={needsApproval || !canMigrate || isPending || isConfirming}
              className="rounded-md bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {step === "migrating" && isPending ? "Awaiting wallet…" :
               step === "migrating" && isConfirming ? "Confirming…" :
               `Migrate ${fmtCZM(v1Bal)} CZM`}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-900/40 border border-red-800 p-3 text-red-200 text-sm">
          {error.message}
        </div>
      )}
      {isConfirmed && (
        <div className="rounded-md bg-green-900/40 border border-green-800 p-3 text-green-200 text-sm">
          Confirmed. Refresh to see updated balances.
        </div>
      )}
    </div>
  );
}

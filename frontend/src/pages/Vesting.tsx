import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, CZMVestingAbi } from "../lib/contracts";
import { fmtCZM } from "../lib/format";

const vest = CONTRACTS.baseSepolia.czmVesting;

interface ScheduleData {
  id: bigint;
  beneficiary: string;
  totalAmount: bigint;
  startTime: bigint;
  cliffDuration: bigint;
  vestingDuration: bigint;
  released: bigint;
  revocable: boolean;
  revoked: boolean;
  releasable: bigint;
}

export default function Vesting() {
  const { t } = useTranslation(["vesting", "common"]);
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const [schedules, setSchedules] = useState<ScheduleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Refresh schedules when a release confirms
  useEffect(() => {
    if (isConfirmed) setReloadTick((t) => t + 1);
  }, [isConfirmed]);

  useEffect(() => {
    if (!isConnected || !address || !client) return;
    setLoading(true);
    (async () => {
      try {
        // Walk scheduleIdsOf(address, i) until it reverts (no helper to get array length).
        const ids: bigint[] = [];
        for (let i = 0n; i < 50n; i++) {
          try {
            const id = (await client.readContract({
              address: vest, abi: CZMVestingAbi, functionName: "scheduleIdsOf", args: [address, i],
            })) as bigint;
            ids.push(id);
          } catch {
            break;
          }
        }
        const out: ScheduleData[] = [];
        for (const id of ids) {
          const s = (await client.readContract({
            address: vest, abi: CZMVestingAbi, functionName: "schedules", args: [id],
          })) as readonly [string, bigint, bigint, bigint, bigint, bigint, boolean, boolean];
          const r = (await client.readContract({
            address: vest, abi: CZMVestingAbi, functionName: "releasable", args: [id],
          })) as bigint;
          out.push({
            id, beneficiary: s[0], totalAmount: s[1], startTime: s[2],
            cliffDuration: s[3], vestingDuration: s[4], released: s[5],
            revocable: s[6], revoked: s[7], releasable: r,
          });
        }
        setSchedules(out);
      } finally {
        setLoading(false);
      }
    })();
  }, [address, client, isConnected, reloadTick]);

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 text-center">
        <p>Connect your wallet to see your vesting schedules.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t("vesting:title")}</h1>
        <p className="text-sm text-neutral-400">{t("vesting:subtitle")}</p>
      </header>

      {loading && <p className="text-neutral-400">Loading…</p>}
      {!loading && schedules.length === 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 text-center text-neutral-400">
          {t("vesting:noSchedules")}
        </div>
      )}

      <div className="space-y-4">
        {schedules.map((s) => {
          const start = new Date(Number(s.startTime) * 1000);
          const cliffEnd = new Date(Number(s.startTime + s.cliffDuration) * 1000);
          const end = new Date(Number(s.startTime + s.vestingDuration) * 1000);
          const pct = s.totalAmount > 0n ? Number((s.released * 10000n) / s.totalAmount) / 100 : 0;
          const canRelease = s.releasable > 0n && !s.revoked;

          return (
            <div key={s.id.toString()} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Schedule #{s.id.toString()}</h3>
                <div className="flex gap-2 text-xs">
                  {s.revocable && <span className="px-2 py-1 rounded bg-yellow-900/40 text-yellow-300">revocable</span>}
                  {s.revoked && <span className="px-2 py-1 rounded bg-red-900/40 text-red-300">revoked</span>}
                </div>
              </div>

              <div className="mb-4">
                <div className="h-2 w-full bg-neutral-800 rounded">
                  <div
                    className="h-2 bg-green-500 rounded"
                    style={{ width: `${pct.toFixed(1)}%` }}
                    aria-label="vest progress"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                <div><dt className="text-neutral-400">{t("vesting:fields.total")}</dt><dd>{fmtCZM(s.totalAmount)} CZM</dd></div>
                <div><dt className="text-neutral-400">{t("vesting:fields.released")}</dt><dd>{fmtCZM(s.released)} CZM ({pct.toFixed(1)}%)</dd></div>
                <div><dt className="text-neutral-400">{t("vesting:fields.releasable")}</dt><dd className="text-green-400 font-semibold">{fmtCZM(s.releasable)} CZM</dd></div>
                <div><dt className="text-neutral-400">{t("vesting:fields.start")}</dt><dd>{start.toLocaleString()}</dd></div>
                <div><dt className="text-neutral-400">{t("vesting:fields.cliffEnds")}</dt><dd>{cliffEnd.toLocaleString()}</dd></div>
                <div><dt className="text-neutral-400">{t("vesting:fields.fullyVested")}</dt><dd>{end.toLocaleString()}</dd></div>
              </div>

              <button
                disabled={!canRelease || isPending || isConfirming}
                onClick={() => writeContract({
                  address: vest, abi: CZMVestingAbi, functionName: "release", args: [s.id],
                })}
                className="rounded-md bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isPending ? t("vesting:awaitingWallet") : isConfirming ? t("vesting:confirming") : t("vesting:release", { amount: fmtCZM(s.releasable) })}
              </button>
            </div>
          );
        })}
      </div>

      {writeError && (
        <div className="rounded-md bg-red-900/40 border border-red-800 p-3 text-red-200 text-sm">
          {writeError.message}
        </div>
      )}
      {isConfirmed && (
        <div className="rounded-md bg-green-900/40 border border-green-800 p-3 text-green-200 text-sm">
          {t("vesting:released")}
        </div>
      )}
    </div>
  );
}

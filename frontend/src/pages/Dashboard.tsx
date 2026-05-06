import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { CONTRACTS, CZMTokenAbi, CZMVestingAbi } from "../lib/contracts";
import { fmtCZM } from "../lib/format";

const v1 = CONTRACTS.baseSepolia.czmTokenV1;
const v2 = CONTRACTS.baseSepolia.czmTokenV2;
const vest = CONTRACTS.baseSepolia.czmVesting;

interface NextUnlock {
  scheduleId: bigint;
  unlockAt: bigint; // unix s
}

export default function Dashboard() {
  const { t } = useTranslation(["dashboard", "common"]);
  const { address, isConnected } = useAccount();
  const client = usePublicClient();

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

  const [totalClaimable, setTotalClaimable] = useState<bigint>(0n);
  const [nextUnlock, setNextUnlock] = useState<NextUnlock | null>(null);

  useEffect(() => {
    if (!isConnected || !address || !client) return;
    void (async () => {
      const ids: bigint[] = [];
      for (let i = 0n; i < 50n; i++) {
        try {
          const id = (await client.readContract({
            address: vest, abi: CZMVestingAbi, functionName: "scheduleIdsOf", args: [address, i],
          })) as bigint;
          ids.push(id);
        } catch { break; }
      }
      let claimable = 0n;
      let next: NextUnlock | null = null;
      const now = BigInt(Math.floor(Date.now() / 1000));
      for (const id of ids) {
        const r = (await client.readContract({
          address: vest, abi: CZMVestingAbi, functionName: "releasable", args: [id],
        })) as bigint;
        claimable += r;

        const s = (await client.readContract({
          address: vest, abi: CZMVestingAbi, functionName: "schedules", args: [id],
        })) as readonly [string, bigint, bigint, bigint, bigint, bigint, boolean, boolean];
        const cliffEnd = s[2] + s[3];
        if (cliffEnd > now && (!next || cliffEnd < next.unlockAt)) {
          next = { scheduleId: id, unlockAt: cliffEnd };
        }
      }
      setTotalClaimable(claimable);
      setNextUnlock(next);
    })();
  }, [address, client, isConnected]);

  const totalCzm = (v1Bal as bigint | undefined ?? 0n) + (v2Bal as bigint | undefined ?? 0n);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("dashboard:title")}</h1>

      {!isConnected && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 text-center">
          {t("common:connect")}
        </div>
      )}

      {isConnected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title={t("dashboard:cards.totalBalance")} value={fmtCZM(totalCzm)} suffix="CZM" />
          <Card
            title={t("dashboard:cards.nextUnlock")}
            value={nextUnlock ? new Date(Number(nextUnlock.unlockAt) * 1000).toLocaleDateString() : "—"}
            subtitle={nextUnlock ? `#${nextUnlock.scheduleId.toString()}` : t("dashboard:noNextUnlock")}
          />
          <Card title={t("dashboard:cards.claimable")} value={fmtCZM(totalClaimable)} suffix="CZM" highlight={totalClaimable > 0n} />
          <Card title={t("dashboard:cards.migration")} value={(v1Bal as bigint | undefined ?? 0n) > 0n ? "v1 → v2 ready" : "—"} />
        </div>
      )}
    </div>
  );
}

function Card({ title, value, subtitle, suffix, highlight }: {
  title: string; value: string; subtitle?: string; suffix?: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-green-700 bg-green-900/30" : "border-neutral-800 bg-neutral-900/50"}`}>
      <dt className="text-sm text-neutral-400">{title}</dt>
      <dd className={`text-2xl font-bold mt-1 ${highlight ? "text-green-300" : "text-white"}`}>
        {value}{suffix && <span className="text-sm font-normal text-neutral-400 ml-1">{suffix}</span>}
      </dd>
      {subtitle && <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>}
    </div>
  );
}

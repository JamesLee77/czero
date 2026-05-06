import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { upsertUser, getUser, markSent, alreadySent } from "../src/db";

beforeEach(async () => {
  const migrations = JSON.parse((env as any).TEST_MIGRATIONS);
  await applyD1Migrations(env.DB, migrations);
});

describe("db", () => {
  it("upsertUser inserts a new row when address is new", async () => {
    const now = 1_700_000_000;
    await upsertUser(env.DB, "0xabc", { language: "en" }, now);
    const u = await getUser(env.DB, "0xabc");
    expect(u?.address).toBe("0xabc");
    expect(u?.email).toBeNull();
    expect(u?.language).toBe("en");
  });

  it("upsertUser updates existing row", async () => {
    const t1 = 1_700_000_000;
    const t2 = 1_700_000_100;
    await upsertUser(env.DB, "0xabc", { language: "en" }, t1);
    await upsertUser(env.DB, "0xabc", { language: "ko" }, t2);
    const u = await getUser(env.DB, "0xabc");
    expect(u?.language).toBe("ko");
    expect(u?.updated_at).toBe(t2);
  });

  it("markSent + alreadySent dedupe by (address, schedule_id, kind)", async () => {
    const now = 1_700_000_000;
    await upsertUser(env.DB, "0xabc", {}, now);
    expect(await alreadySent(env.DB, "0xabc", 0, "claim_ready")).toBe(false);
    await markSent(env.DB, "0xabc", 0, "claim_ready", now);
    expect(await alreadySent(env.DB, "0xabc", 0, "claim_ready")).toBe(true);
    expect(await alreadySent(env.DB, "0xabc", 0, "cliff_7d")).toBe(false);
  });
});

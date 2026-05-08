# Phase 1 MVP — E2E test results (Base Sepolia)

**Date:** 2026-05-07
**Network:** Base Sepolia (chainId 84532)
**Tester:** misterylee@gmail.com (admin EOA)
**Result:** ✅ All required sections passed. Phase 1 MVP is operational.

## Production endpoints

| | |
|---|---|
| Frontend | https://czero-portal.pages.dev |
| Backend API | https://czero-portal-api.misterylee.workers.dev |
| D1 database | `czero-portal-db` (remote) |

## Deployed contracts

| Contract | Address |
|---|---|
| CZM v1 (legacy) | [`0x5b4319dB4b2949E921400D850838508BB8a510CE`](https://sepolia.basescan.org/address/0x5b4319dB4b2949E921400D850838508BB8a510CE) |
| CZM v2 (utility) | [`0xC51AC33D23f7cCff7ddF83b751C52AF8ff50057c`](https://sepolia.basescan.org/address/0xC51AC33D23f7cCff7ddF83b751C52AF8ff50057c) |
| CZMVesting | [`0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79`](https://sepolia.basescan.org/address/0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79) |
| CZMMigration | [`0x1a3Fb22873fF0778069c7708A40E1CEA48Bb660c`](https://sepolia.basescan.org/address/0x1a3Fb22873fF0778069c7708A40E1CEA48Bb660c) |

## Test wallets

| Role | Address |
|---|---|
| Admin (deployer / Vesting owner) | `0xB722843587DA96bdFb5638Bb0AbC8FC56a9dfa1D` |
| Alice (investor) | `0xD4EecF3a15e6727C91E2435216e4f071717411F0` |
| Bob (investor) | `0x953e7c875e0636171a3c223148183c4a8b604e5B` |
| Carol (early-cliff investor) | `0xAF2f45364657d9A9e40b80489Ed15baDC4dc098D` |

Private keys for Alice/Bob/Carol live in `.env` (gitignored). All four are imported into MetaMask for UI testing.

## Section results

### §1 Wallet connection — ✅
- RainbowKit modal opens, MetaMask connects, Base Sepolia auto-switch works
- Locale forced to `en-US` (RainbowKit was defaulting to Korean)

### §2 SIWE sign-in — ✅
- Cookie set with `SameSite=None; Secure` for cross-origin SPA → API
- viem `verifySiweMessage` validates domain/chainId
- Atomic nonce consumption (`DELETE...RETURNING`)

### §3 Email subscription — ✅ (validated 2026-05-08 in Sprint 2 / M1)
- Resend API key provisioned (`onboarding@resend.dev` sandbox sender to `misterylee@gmail.com`)
- Subscribe → verify email link → DB shows `email_verified=1` for Alice (`0xd4ee…11f0`)
- Bug found and fixed mid-test (PR #16): Resend strict-string-compares the recipient against the account-owner email. Subscribe with `misteryLee@gmail.com` (capital L) returned 403 / EMAIL_SEND_FAILED. Backend now `.trim().toLowerCase()` at the API boundary.

### §4 Vesting — ✅
4 schedules created and exercised end-to-end:

| # | Beneficiary | Total | Cliff | Duration | Tx |
|---|---|---|---|---|---|
| 1 | Admin | 500 | 60s | 10min | release: [`0x8fa99ba4…`](https://sepolia.basescan.org/tx/0x8fa99ba4) |
| 2 | Alice | 1000 | — | — | release: [`0xd37c8dab…`](https://sepolia.basescan.org/tx/0xd37c8dab) |
| 3 | Bob | 2000 | — | — | release: [`0x3d7bf768…`](https://sepolia.basescan.org/tx/0x3d7bf768) |
| 4 | Carol | 300 | (fully vested) | — | revoke: distributed all 300 to Carol |

Total CZM v1 minted via vesting: **3800**, all distributed (vesting balance = 0).

### §5 Cron emails — ✅ (validated 2026-05-08 in Sprint 2 / M1)
- 3 test schedules created for Alice (#5 cliff_7d, #6 cliff_1d, #7 claim_ready) — see `scripts/_e2e-cron-test-setup.ts`
- Manual cron triggered via `wrangler dev --remote --test-scheduled` + `curl /__scheduled?cron=0+*+*+*+*`
- 1st trigger: `sent_notifications` gained 3 rows (one per kind), 3 emails delivered to `misterylee@gmail.com`
- 2nd trigger: `sent_notifications` unchanged (still 3 rows), 0 new emails — dedupe path verified
- Cleanup: schedule #7 fully vested → Alice released 10 CZM. #5/#6 are non-revocable; locked 20 CZM v1 will vest naturally over 7 days. `sent_notifications` rows kept (would otherwise re-trigger on next prod cron).

### §6 Migrate (v1 → v2) — ✅
Holders migrated:

| Wallet | v1 burned | v2 minted | Tx (migrate) |
|---|---|---|---|
| Alice | 1000 | 1000 | [`0x8f6ac21c…`](https://sepolia.basescan.org/tx/0x8f6ac21cd5fb33c11afa327927114e395ec07f76327b0682c7792dd8229507a9) |
| Admin | 500 | 500 | [`0xd0373121…`](https://sepolia.basescan.org/tx/0xd03731213e776773d2f47d1e8a81b09bab2c815be832a89e34a72b653f4d7949) |
| Bob | 2000 | 2000 | [`0xa4b69818…`](https://sepolia.basescan.org/tx/0xa4b6981844adc6d2f14fa927a14f3554360f1c3fdcb12e126cdb82c5c6516815) |
| Carol | 300 | 300 | [`0x7e62758e…`](https://sepolia.basescan.org/tx/0x7e62758efe12b09552b9e34108f45b4a8a4a37a41f0fd75b50abe288c8a1dde5) |

**Final supply state:** v1 = 0 (fully retired), v2 = 4800. Migration is reversible only by re-deploying v1 — i.e., the testnet sale is now permanently in v2.

### §7 Logout — ✅ (validated 2026-05-08 in Sprint 2 / M2)
- Backend test added: `POST /api/auth/logout clears the siwe_session cookie` in `auth.test.ts` (48 tests total now)
- E2E HTTP-level validation via `scripts/_e2e-logout-test.ts` against the prod worker — 21/21 assertions pass:
  - Anonymous `GET /api/me` and `POST /api/me/email` both return 401 (requireSession)
  - `POST /api/auth/logout` (no cookie) still returns 200 + Set-Cookie clearing `siwe_session` with `Max-Age=0`, `SameSite=None`, `Secure`, `Path=/`
  - Full SIWE flow: nonce → sign (ephemeral wallet) → verify → cookie set with positive Max-Age → authed `/api/me` returns 200 with the address
  - Authed logout returns 200 + Set-Cookie clearing the cookie
- **Architecture clarification:** `/vesting` does not require SIWE — it's a pure on-chain read using wagmi's `isConnected`. SIWE only gates `/api/me/*` and email features. The original sprint-2 plan item "Logout → /vesting redirects to /" was inaccurate; corrected here.
- **Known limitation:** sessions are stateless (HMAC-signed cookie, no server-side session table). Logout instructs the browser to drop the cookie, but a captured cookie remains valid until the TTL expires. Acceptable for Phase 1; revisit if attack surface grows.

### §8 Mobile responsive — not exercised
- Tailwind v4 responsive classes throughout. Not visually verified.

## Test infrastructure built during E2E

Hardhat scripts used to script operations rather than walk through UI manually:

| Script | Purpose |
|---|---|
| `scripts/_e2e-create-schedule.ts` | Admin schedule #1 (timed cliff) |
| `scripts/_e2e-setup-scenarios.ts` | Alice/Bob/Carol schedules #2-4 |
| `scripts/_e2e-revoke-carol.ts` | Revoke fully-vested schedule |
| `scripts/_e2e-release-{alice,bob,admin}.ts` | Release vested portion |
| `scripts/_e2e-migrate-alice.ts` | Single-wallet v1→v2 migration |
| `scripts/_e2e-migrate-rest.ts` | Bulk migrate remaining holders |
| `scripts/_e2e-cron-test-setup.ts` | M1-3: 3 trigger schedules (cliff_7d / cliff_1d / claim_ready) |
| `scripts/_e2e-cron-test-cleanup.ts` | M1-3: release whatever's vested from cron-test schedules |
| `scripts/_e2e-logout-test.ts` | M2: full SIWE → /api/me → logout flow vs prod worker (21 assertions) |

These are intentionally underscore-prefixed to mark them as throwaway E2E artifacts (not production scripts).

## Bugs found and fixed during E2E

| ID | Severity | Issue | Fix |
|---|---|---|---|
| C1 | Critical | `SameSite=Strict` cookie blocked cross-origin SPA→API | Changed to `SameSite=None; Secure` |
| C2 | Critical | Email verify URL pointed to frontend (no route) | Added `API_BASE_URL` env, `renderEmailVerify` uses it |
| C3 | Critical | Resend rejects recipient when case differs from account-owner email (`misteryLee@` vs `misterylee@`) → Worker returned 502 EMAIL_SEND_FAILED | Backend `.trim().toLowerCase()` at API boundary (PR #16, found during M1-2) |
| — | UX | RainbowKit defaulted to Korean | Forced `locale="en-US"` in `RainbowKitProvider` |
| — | UX | Contract addresses not copyable on dashboard | Created `CopyableAddress` component, used on Home + Settings |

## Carry-over items for next phase

1. ~~**Real Resend API key** — replace placeholder, then re-run §3 + §5~~ — done in Sprint 2 / M1
2. ~~**Logout smoke test (§7)** — 5 min check before any mainnet rollout~~ — done in Sprint 2 / M2
3. **Mobile pass (§8)** — DevTools responsive view sweep (Sprint 2 / M3)
4. **Subscriber email pruning** — `users.email` rows accumulate; consider GDPR-style purge (Sprint 2 / S1)
5. **Mainnet deploy plan** — separate runbook; reuse this script library with mainnet RPC + key vault (Sprint 2 / P2)
6. **Custom Resend sending domain** — current sandbox sender only delivers to account-owner email; verify a real domain to enable external subscribers

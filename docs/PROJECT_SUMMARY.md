# C-ZERO ($CZM) — Project summary

> Consolidated record of work completed on the C-ZERO Mining Token (CZM) project as of **2026-05-08**. Phase 1 MVP shipped to Base Sepolia; Sprint 2 closed with email + logout validated end-to-end. Open scope is captured at the bottom.

## Status at a glance

| Layer | State |
|---|---|
| Smart contracts | 4 contracts deployed to Base Sepolia, all verified on BaseScan |
| Backend (Cloudflare Worker) | `https://czero-portal-api.misterylee.workers.dev` — 48/48 tests green |
| Frontend (Cloudflare Pages) | `https://czero-portal.pages.dev` |
| Database (Cloudflare D1) | `czero-portal-db` migrated + populated |
| Email (Resend) | Live, sandbox sender to account-owner email |
| Mainnet | Not deployed; runbook not yet drafted |

## Timeline

| Phase | Period | Outcome |
|---|---|---|
| 0 — Token design + audit | through 2026-05-06 | 4-contract architecture finalized, Slither + manual review passes; L-02/L-03 fixes applied; 160 contract tests green |
| 1a — Testnet deploy | 2026-05-06 | All 4 contracts deployed and verified on Base Sepolia; pre-sale + migration simulations rehearsed |
| 1b — Investor portal MVP | 2026-05-06 → 2026-05-07 | Cloudflare Worker backend + Pages frontend; SIWE auth, email subscribe, hourly cron notifications, vesting page, migrate page; full English localisation; 14 PRs merged |
| 1c — Phase 1 E2E walkthrough | 2026-05-07 | §1, §2, §4, §6 validated live; 2 critical bugs caught and fixed (SameSite cookie, verify URL); §3/§5 deferred pending Resend key |
| 2 — Production hardening (partial) | 2026-05-07 → 2026-05-08 | Sprint 2 M1 + M2 done: real Resend key, §3/§5/§7 validated; case-insensitivity bug fixed (PR #16); rest of Sprint 2 deferred |

## Smart contracts (Base Sepolia, chainId 84532)

| Contract | Address | Purpose |
|---|---|---|
| CZM v1 | [`0x5b4319dB4b2949E921400D850838508BB8a510CE`](https://sepolia.basescan.org/address/0x5b4319dB4b2949E921400D850838508BB8a510CE) | Pre-sale token (legacy); fully retired after migration |
| CZM v2 | [`0xC51AC33D23f7cCff7ddF83b751C52AF8ff50057c`](https://sepolia.basescan.org/address/0xC51AC33D23f7cCff7ddF83b751C52AF8ff50057c) | Utility token (post-migration) |
| CZMVesting | [`0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79`](https://sepolia.basescan.org/address/0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79) | Linear vesting w/ cliff, revocable schedules |
| CZMMigration | [`0x1a3Fb22873fF0778069c7708A40E1CEA48Bb660c`](https://sepolia.basescan.org/address/0x1a3Fb22873fF0778069c7708A40E1CEA48Bb660c) | 1:1 v1 → v2 burn-and-mint |

Contract test suite: **160 tests passing**. See `SECURITY_REVIEW.md` for the audit findings and fixes.

## Investor portal

### Backend — Cloudflare Worker (`backend/`)

- **Stack:** Hono, viem, Cloudflare D1, Web Crypto HMAC sessions
- **Routes:** `/api/auth/{nonce,verify,logout}`, `/api/me`, `/api/me/email`, `/api/email/verify`, scheduled handler
- **Auth:** SIWE (EIP-4361) via viem `verifySiweMessage` (EOA mode), atomic nonce consumption, HMAC-signed cookie sessions
- **Email:** Resend integration with 4 templates (verify, claim-ready, cliff-7d, cliff-1d)
- **Cron:** `0 * * * *` — reads vesting schedules from chain, sends notifications, dedupes via `sent_notifications` table
- **Tests:** **48/48** green (Vitest + miniflare)

### Frontend — Cloudflare Pages (`frontend/`)

- **Stack:** Vite 8, React 18, wagmi v2, RainbowKit, Tailwind v4, react-i18next (English-only with infra for additional locales)
- **Pages:** Home (4-KPI dashboard + Contracts card), Vesting (per-schedule progress bars + Release), Migrate (Approve + Migrate flow), Settings (SIWE sign-in, email subscribe, notification prefs)
- **Auth UX:** RainbowKit forced to `en-US`; `siwe_session` cookie set with `SameSite=None; Secure` for cross-origin SPA → API

### Database — Cloudflare D1 (`czero-portal-db`)

Tables:
- `users` — wallet → email + verification state + notification prefs + language
- `auth_nonces` — short-lived SIWE nonces (atomically consumed via `DELETE...RETURNING`)
- `sent_notifications` — dedupe table for cron emails (`address`, `schedule_id`, `kind`, `sent_at`)

## E2E validation (Base Sepolia)

| § | Section | Status | Reference |
|---|---|---|---|
| 1 | Wallet connection | ✅ | `runbooks/2026-05-07-mvp-e2e-results.md` |
| 2 | SIWE sign-in | ✅ | same |
| 3 | Email subscription + verify | ✅ (Sprint 2 / M1) | same |
| 4 | Vesting (4 schedules created, 3800 CZM v1 distributed) | ✅ | same |
| 5 | Cron emails (3 notification kinds + dedupe) | ✅ (Sprint 2 / M1) | same |
| 6 | Migrate v1 → v2 (4 holders, 4800 CZM total) | ✅ | same |
| 7 | Logout (HTTP-level, 21 assertions) | ✅ (Sprint 2 / M2) | same |
| 8 | Mobile responsive | not exercised | Sprint 2 / M3 deferred |

## Bugs caught and fixed during the journey

| ID | Severity | Issue | Fix | PR |
|---|---|---|---|---|
| C1 | Critical | `SameSite=Strict` cookie blocked cross-origin SPA → API | Changed to `SameSite=None; Secure` | merged before E2E |
| C2 | Critical | Email verify URL pointed to frontend (no route) | Added `API_BASE_URL` env, `renderEmailVerify` uses it | merged before E2E |
| C3 | Critical | Resend rejected case-mismatched recipient (`misteryLee@` vs `misterylee@`) → 502 EMAIL_SEND_FAILED | Backend `.trim().toLowerCase()` at API boundary | #16 |
| L1 | UX | RainbowKit defaulted to Korean | Forced `locale="en-US"` | #13 |
| L2 | UX | Contract addresses not copyable on dashboard | New `CopyableAddress` component | #14 |
| L3 | UX | Verify URL flash banner contradicted unverified state — diagnostic UX | Documented, no code change | n/a |

## Test infrastructure

Throwaway Hardhat scripts (underscore-prefixed) used to script E2E operations rather than walk through the UI manually:

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

Private keys load from `.env` (gitignored): `ALICE_/BOB_/CAROL_PRIVATE_KEY`.

## Operational state on close (2026-05-08)

- **Worker version:** `d7c85e9b` (PR #16 + later doc-only changes have not changed the bundle)
- **Worker secrets:** `RESEND_API_KEY`, `SIWE_SECRET`
- **D1 users table:** 1 row — Alice (`0xd4ee…11f0`), email-verified
- **D1 sent_notifications:** 3 rows (cliff_7d / cliff_1d / claim_ready for Alice's schedules #5-7)
- **Vesting contract balance:** 20 CZM v1 locked across schedules #5/#6 (non-revocable, will vest naturally over 7 days)
- **Token holdings:**
  - CZM v1 supply: 30 (10 in vesting #5, 10 in vesting #6, 10 in Alice from #7)
  - CZM v2 supply: 4800 (810 admin / 1000 Alice / 2000 Bob / 300 Carol / 690 across earlier-test wallets)

## Open / deferred (Sprint 2 leftovers)

| Item | Status | Notes |
|---|---|---|
| M3 — mobile responsive sweep | deferred | DevTools 375/414/768 walkthrough |
| S1 — GDPR-friendly subscriber data deletion | deferred | `DELETE /api/account` + cron purge |
| S2 — admin schedule creation UI | deferred | replaces `_e2e-create-schedule.ts` |
| P1 — Phase 2 utility brainstorm | deferred | mining/staking/node tier design |
| P2 — mainnet deploy runbook | deferred | pre-flight, multisig, deploy ordering, rollback |
| Custom Resend sending domain | deferred | sandbox sender only delivers to account-owner email |
| Vesting #5/#6 chain artifact cleanup | natural | 20 CZM v1 will vest to Alice over 7 days |

## Document index

| Path | Content |
|---|---|
| `README.md` | Top-level project intro |
| `CZM_Business_Model_and_Requirements.md` | Business model + requirements |
| `CZM_Token_Design.md` | Tokenomics + contract design |
| `SECURITY_REVIEW.md` | Audit findings + remediation |
| `DEPLOYMENT.md` | Contract + portal deployment notes |
| `docs/superpowers/specs/2026-05-06-phase1-mvp-investor-portal-design.md` | Phase 1 MVP design spec |
| `docs/superpowers/plans/2026-05-07-phase1-mvp-investor-portal.md` | Phase 1 MVP implementation plan (25 tasks) |
| `docs/superpowers/sprints/2026-05-07-sprint-2-plan.md` | Sprint 2 plan |
| `docs/superpowers/runbooks/2026-05-07-mvp-e2e-checklist.md` | E2E walkthrough checklist |
| `docs/superpowers/runbooks/2026-05-07-mvp-e2e-results.md` | E2E walkthrough results (live updates) |

## Pull request history

| # | Title | Status |
|---|---|---|
| 12 | feat(backend): worker scaffold | merged |
| 13 | fix(frontend): force RainbowKit locale to en-US | merged |
| 14 | feat(frontend): copyable contract addresses + Contracts card | merged |
| 15 | docs: Sprint 2 plan | merged |
| 16 | fix(backend): normalize email to lowercase before subscribe | merged |
| 17 | docs: close Sprint 2 / M1 — email §3/§5 validated end-to-end | merged |
| 18 | sprint-2/m2: validate logout end-to-end vs prod worker | merged |

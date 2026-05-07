# Sprint 2 — Production hardening + Phase 2 kickoff

**Window:** 2026-05-08 → ~2026-05-21 (2 weeks, suggested)
**Goal:** Close Phase 1 carry-overs, lay groundwork for Phase 2 (CZM v2 utility).
**Status:** Draft — open for review.

## Where we are

Phase 1 testnet E2E is **green** (see `runbooks/2026-05-07-mvp-e2e-results.md`). Four contracts live on Base Sepolia, frontend + backend deployed, 4 holders' v1 fully migrated to v2. Remaining gaps:

- Email path needs real Resend key (§3, §5 deferred)
- Logout (§7) and mobile (§8) not exercised
- Subscriber email rows accumulate without purge mechanism
- No mainnet runbook
- Phase 2 (utility for v2) not yet specced

## Must-do — production readiness

### M1. Real Resend API key + §3/§5 re-test
- Provision Resend account, verify sending domain (DNS DKIM/SPF)
- `wrangler secret put RESEND_API_KEY` on prod worker
- Re-run E2E §3 (subscribe + verify) and §5 (cron emails)
- **DoD:** real email arrives within 60s; cron run delivers cliff-7d / cliff-1d / claim-ready notifications without dupes

### M2. §7 Logout smoke test
- Manual: connect → SIWE → logout → confirm cookie cleared, /vesting redirects to /
- Add Vitest case for `POST /api/auth/logout` (cookie expiry header set)
- **DoD:** runbook checkbox ticked; one new backend test green

### M3. §8 Mobile responsive sweep
- DevTools mobile profiles (375 / 414 / 768) for all routes: Home, Settings, Vesting, Migrate, Login, 404
- Fix overflow / hit-target / hamburger issues found
- **DoD:** screenshots filed in PR; no horizontal scroll on any route at 375px

## Should-do — operational debt

### S1. Subscriber data deletion (GDPR-friendly)
- New endpoint: `DELETE /api/account` purges `users` row for the SIWE-signed wallet
- New Settings UI button: "Delete my data" with confirm modal
- New cron path: purge unverified emails older than 30 days
- **DoD:** unit-tested, UI button works, runbook section added

### S2. Admin schedule creation UI
- Replace `_e2e-create-schedule.ts` script with admin-only Settings panel
- Form fields: beneficiary address, total CZM, cliff seconds, vesting seconds, revocable
- Reuses wagmi write hook + existing toast pattern
- **DoD:** admin can create + revoke schedules from UI; non-admin sees nothing

## Kickoff — Phase 2 planning

### P1. Phase 2 utility brainstorming (CZM v2)
- Use `superpowers:brainstorming` skill to spec what v2 actually does beyond migration
- Candidates from prior discussion: mining rewards, light staking, governance signaling, node tier system
- Deliver: `specs/YYYY-MM-DD-czm-v2-utility-design.md`
- **DoD:** spec committed, scope decomposed into Phase 2.1 / 2.2 sub-projects

### P2. Mainnet deploy runbook (draft only)
- Document: pre-flight checks, multisig setup, deploy ordering, BaseScan verify, rollback plan
- Use Phase 1 deploy as template; flag gates that block execution (audit, key custody decision)
- **DoD:** runbook in `runbooks/`, reviewed, **not executed** this sprint

## Explicitly out of scope

- Mainnet deployment (waits on audit + multisig + business sign-off)
- Phase 2 implementation (requires P1 design first)
- Sentry / observability stack (Sprint 3 candidate)
- Rate limiting beyond Cloudflare defaults (Sprint 3)
- Token economics changes (separate planning track)

## Risks / dependencies

| Risk | Mitigation |
|---|---|
| Resend DNS verification can take 24–48h | Start M1 day 1 of sprint |
| Mobile fix scope unknown until walkthrough | Buffer M3; descope cosmetic fixes if budget tight |
| P1 brainstorming may surface contract changes | Acceptable — flag for next sprint, do not rush spec |
| Admin UI (S2) may need new RBAC checks | Keep gate simple: hardcode admin address client+server |

## Sprint close criteria

- ✅ M1, M2, M3 all complete
- ✅ At least one of S1/S2 shipped to prod
- ✅ P2 runbook drafted
- 🟡 P1 brainstorm started (completion not required this sprint)

## Open questions for sprint kickoff

1. Two-week sprint OK, or do we need a different cadence?
2. Who is the test audience for §3/§5 email validation — admin only, or invite a few external testers?
3. Phase 2 P1: are mining mechanics already decided in `CZM_Business_Model_and_Requirements.md`, or genuinely open?
4. Do we want a Sprint 3 stub created at the same time, or defer until Sprint 2 retro?

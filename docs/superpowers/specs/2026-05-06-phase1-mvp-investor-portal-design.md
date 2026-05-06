# Phase 1 MVP — C-ZERO Investor Portal Design

**Date**: 2026-05-06
**Status**: Approved (pending implementation plan)
**Scope**: Phase 1 MVP for the C-ZERO investor onboarding round
**Network**: Base Sepolia (testnet only — mainnet migration deferred)

---

## 1. Goal

Onboard 10–30 Strategic SAFT investors with on-chain vesting tracking, a polished investor portal, and email notifications for vesting milestones. Real legal commitment is in the SAFT (off-chain); the portal lets each investor see and claim their on-chain Vesting schedule and stay aware of upcoming unlocks.

**Success criteria** (acceptance):

- An investor receives an emailed vesting schedule confirmation, connects their wallet to the portal, sees their schedule, and successfully claims a vested portion via the UI.
- The system emails them at 7 days before a cliff, 1 day before a cliff, and when a claim is ready.
- The founder can onboard a new investor by running a single Hardhat command (mint + createSchedule) and adding the investor's wallet/email row in D1 — no admin web UI required.

## 2. Constraints

| Constraint | Value |
|---|---|
| Investor count | 10–30 (small, manageable) |
| KYC | Manual (off-chain SAFT review by founder); no Sumsub / Persona oracle |
| Network | Base Sepolia (testnet) |
| Deployer / admin | Single EOA `0xB722843587DA96bdFb5638Bb0AbC8FC56a9dfa1D` (testnet dev key) |
| Hosting | Cloudflare Pages (frontend) + Cloudflare Worker (backend) |
| Languages | English only in copy; i18n infrastructure ready for future locales |
| External audit | Not in scope for testnet; required before mainnet (separate work) |
| Multisig + Timelock | Not in scope for testnet; required before mainnet (separate work) |

## 3. Architecture overview

```
                        ┌─────────────────────────────────┐
                        │  Investor Browser               │
                        │  https://czero-portal.pages.dev │
                        └───────────────┬─────────────────┘
                                        │
                  ┌─────────────────────┼─────────────────────┐
                  │                     │                     │
        wagmi + RainbowKit       fetch to Worker      i18next (EN now)
                  │                     │
                  │           ┌─────────▼──────────────┐
                  │           │ Cloudflare Worker      │
                  │           │ api.czero.io (or sub)  │
                  │           ├─ POST /auth/nonce       │
                  │           ├─ POST /auth/verify SIWE │
                  │           ├─ GET  /me               │
                  │           ├─ PUT  /me               │
                  │           ├─ POST /me/email         │
                  │           └─ scheduled (cron 1h)    │
                  │                     │
                  │            ┌────────┴─────────┐
                  │            │                  │
                  │       Cloudflare D1       Resend (email)
                  │
                  ▼
           Base Sepolia RPC
           (CZMToken / CZMVesting / CZMMigration)
```

## 4. Components

### 4.1 Frontend (`frontend/`, extends existing Vite app)

**New pages**

- `pages/Dashboard.tsx` — landing after wallet connect; 4 summary cards (Total CZM Balance, Next Unlock, Currently Claimable, Migration Status) + recent activity (last 5 events).
- `pages/Settings.tsx` — wallet management, email subscription form, notification preferences toggles, language selector (EN only for now), SIWE sign-in to access.

**Polish on existing pages**

- `pages/Vesting.tsx` — visualised vesting curve + card layout. Already lists schedules; add progress bar + dates.

**Kept as-is**

- `pages/Migrate.tsx` — already covers v1 → v2 swap.

**New infrastructure**

- `lib/i18n.ts` — react-i18next bootstrap with EN as default and KO/JA placeholders for later.
- `locales/en.json` — every user-visible string keyed by `<page>.<section>.<element>`.
- `lib/siwe.ts` — Sign-In-With-Ethereum (EIP-4361) message builder + signature flow using `viem`.
- `lib/api.ts` — typed fetch wrapper for backend Worker (cookie-based session).

### 4.2 Backend Worker (`backend/`, new)

Single Cloudflare Worker (Module Worker syntax) handling both HTTP API and scheduled events. Bound to:

- `DB`: D1 database
- `RESEND_API_KEY`: secret
- `RPC_URL`: env var (`https://sepolia.base.org`)
- `SIWE_SECRET`: secret used to sign session cookies
- `ALLOWED_ORIGIN`: env var (`https://czero-portal.pages.dev`)
- Contract addresses: env vars

**HTTP routes**

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/nonce` | none | `{ address }` | `{ nonce, message }` (also stored in `auth_nonces`) |
| POST | `/api/auth/verify` | none | `{ message, signature }` | sets HttpOnly `siwe_session` cookie + `{ address }` |
| POST | `/api/auth/logout` | cookie | — | clears cookie |
| GET  | `/api/me` | cookie | — | `{ address, email, email_verified, notif_prefs, language }` |
| PUT  | `/api/me` | cookie | `{ notif_prefs?, language? }` | `{ ok: true }` |
| POST | `/api/me/email` | cookie | `{ email }` | sends verification email; `{ ok: true }` |
| GET  | `/api/me/email/verify?token=…` | none | — | redirects to portal with success/failure message |

**Scheduled handler**

`scheduled` event handler triggered hourly via cron expression `0 * * * *`. Pseudocode:

```ts
async function scheduled(event, env) {
  const count = await readContract(...VestingAbi.getScheduleCount);
  for (let id = 0n; id < count; id++) {
    const s = await readSchedule(id);
    if (s.revoked) continue;

    const cliffEnd = s.startTime + s.cliffDuration;
    const now = BigInt(Math.floor(Date.now() / 1000));
    const dt = cliffEnd - now;

    if (dt > 6.5n * DAY && dt <= 7.5n * DAY) await maybeSend(s, 'cliff_7d', env);
    if (dt > 0.5n * DAY && dt <= 1.5n * DAY) await maybeSend(s, 'cliff_1d', env);

    const releasable = await readReleasable(id);
    if (releasable > 0n) await maybeSend(s, 'claim_ready', env);
  }
}

async function maybeSend(schedule, kind, env) {
  const user = await db.getUser(schedule.beneficiary);
  if (!user?.email_verified || !user.notif_prefs[kind]) return;
  if (await db.alreadySent(user.address, schedule.id, kind)) return;
  await resend.send({ ...templates[kind](schedule, user.language) });
  await db.markSent(user.address, schedule.id, kind);
}
```

### 4.3 D1 schema

```sql
CREATE TABLE users (
  address          TEXT PRIMARY KEY,                         -- 0x… lowercased
  email            TEXT,                                     -- nullable
  email_verified   INTEGER NOT NULL DEFAULT 0,               -- 0/1
  email_token      TEXT,                                     -- pending verify token
  email_token_exp  INTEGER,                                  -- token expiry (unix s)
  notif_prefs      TEXT NOT NULL DEFAULT '{"cliff_7d":true,"cliff_1d":true,"claim_ready":true}',
  language         TEXT NOT NULL DEFAULT 'en',
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE sent_notifications (
  address          TEXT NOT NULL,
  schedule_id      INTEGER NOT NULL,
  kind             TEXT NOT NULL,                            -- 'cliff_7d' | 'cliff_1d' | 'claim_ready'
  sent_at          INTEGER NOT NULL,
  PRIMARY KEY (address, schedule_id, kind)
);

CREATE TABLE auth_nonces (
  nonce            TEXT PRIMARY KEY,
  address          TEXT NOT NULL,
  expires_at       INTEGER NOT NULL                          -- 5 minutes from issue
);
```

`address` is always stored lowercased to avoid case-sensitivity bugs.

### 4.4 Email templates (Resend)

| Template | Trigger | Subject | Body summary |
|---|---|---|---|
| `cliff_7d` | 7 days before cliff ends | "Your CZM cliff ends in 7 days" | Schedule total, cliff end date, link to portal |
| `cliff_1d` | 1 day before cliff ends | "Your CZM cliff ends tomorrow" | Same, urgency |
| `claim_ready` | Releasable > 0 (first time per schedule) | "Vested CZM ready to claim" | Releasable amount, claim link |
| `email_verify` | User submits new email | "Verify your CZM portal email" | One-time verify link |

All templates served as plain HTML + plaintext fallback. No tracking pixels.

## 5. Authentication (SIWE / EIP-4361)

1. Client posts `{ address }` to `/api/auth/nonce`. Server stores `(nonce, address, expires_at)` in `auth_nonces` and returns the EIP-4361-formatted message text including the nonce.
2. Client prompts the wallet to sign that exact message via `wallet.signMessage(message)`.
3. Client posts `{ message, signature }` to `/api/auth/verify`. Server:
   - Parses the SIWE message; ensures the address matches the signer (recover via `viem.verifyMessage`).
   - Looks up the nonce in `auth_nonces`, ensures it has not expired and matches the message.
   - Deletes the nonce row (single-use).
   - Issues an HttpOnly, Secure, SameSite=Lax `siwe_session` cookie containing a JWT-style payload `{ address, exp }` signed with `SIWE_SECRET` (HS256). Lifetime: 7 days.
4. Subsequent API calls go through a `requireSession` middleware that verifies the cookie signature, expiry, and attaches `request.address`.

## 6. i18n strategy

- `react-i18next` + `i18next-browser-languagedetector`.
- Single namespace (`common`) is sufficient for MVP.
- Every user-visible string is wrapped in `t('dashboard.cards.totalBalance.label')`.
- Only `en.json` ships with content. `ko.json`, `ja.json`, etc. are added later as needed.
- Settings page exposes a language selector but only EN is selectable for now.

## 7. Error handling

| Scenario | Behaviour |
|---|---|
| SIWE signature invalid or address mismatch | 401, body `{ error: "INVALID_SIGNATURE" }` |
| Cookie missing / expired / invalid signature | 401, client redirects to `/` and prompts SIWE again |
| Resend 4xx (bad recipient, etc.) | log + record failed send; do **not** mark `sent_notifications` |
| Resend 5xx (transient) | next cron retry will resend (sent_notifications row remains absent) |
| RPC failure mid-cron | log error, skip remaining schedules; cron retries next hour |
| User unsubscribes (clears email) | `email = NULL`, `email_verified = 0`, but `notif_prefs` retained |
| Schedule revoked between cron runs | scheduled handler skips (`if (s.revoked) continue`) |

## 8. Testing strategy

- **Smart contracts**: existing 160-test Hardhat suite stays green (no changes expected).
- **Backend Worker**: Vitest + miniflare. Unit-test SIWE verification, dedupe logic, cron schedule scanner against an in-memory D1. Mock `viem` reads with fixture schedule data.
- **Frontend**: skip unit tests in MVP; rely on TypeScript and manual visual QA.
- **End-to-end (manual)**: deploy to testnet, walk Alice through:
  1. Visit portal, connect wallet, sign in with Ethereum.
  2. See empty Dashboard (no schedules).
  3. Run `npm run create-schedule -- 0xAlice 1000` (founder) — schedule appears in Vesting.
  4. Subscribe an email in Settings, click verify link.
  5. Set cliff close to now in script; trigger Worker cron manually with `wrangler dev --test-scheduled`.
  6. Receive `cliff_7d` then `cliff_1d` then `claim_ready` emails.
  7. Click "Claim" in Vesting page; tokens land in wallet.

## 9. Deployment plan

1. **D1 provision**: `wrangler d1 create czero-portal-db`. Capture binding ID.
2. **Worker secrets**: `wrangler secret put RESEND_API_KEY`, `wrangler secret put SIWE_SECRET`.
3. **Worker deploy**: `cd backend && wrangler deploy`. Sets up cron trigger.
4. **DNS**: route `api.czero.io` → Worker (or accept default `czero-portal-api.<account>.workers.dev`).
5. **Frontend**: configure `VITE_API_BASE_URL` env in Cloudflare Pages → redeploy with `cd frontend && npm run deploy`.
6. **Smoke test**: hit `/api/auth/nonce` from production URL; verify response.

## 10. Repository layout

```
czero/
├── contracts/                 (existing)
├── scripts/                   (existing) — Hardhat deploy/admin scripts
├── test/                      (existing)
├── frontend/                  (existing — Vite app)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx               (existing)
│   │   │   ├── Dashboard.tsx          (NEW)
│   │   │   ├── Vesting.tsx            (existing — polish)
│   │   │   ├── Settings.tsx           (NEW)
│   │   │   └── Migrate.tsx            (existing)
│   │   ├── lib/
│   │   │   ├── i18n.ts                (NEW)
│   │   │   ├── siwe.ts                (NEW)
│   │   │   ├── api.ts                 (NEW)
│   │   │   └── … (existing)
│   │   └── locales/en.json            (NEW)
│   └── …
├── backend/                   (NEW — Cloudflare Worker)
│   ├── src/
│   │   ├── index.ts                   (router, fetch handler)
│   │   ├── scheduled.ts               (cron handler)
│   │   ├── auth.ts                    (SIWE verify, cookie issue)
│   │   ├── db.ts                      (D1 helpers)
│   │   ├── email.ts                   (Resend client + templates)
│   │   ├── chain.ts                   (RPC reads via viem)
│   │   └── types.ts
│   ├── migrations/
│   │   └── 0001_init.sql              (D1 schema)
│   ├── test/
│   │   ├── auth.test.ts
│   │   ├── scheduled.test.ts
│   │   └── …
│   ├── wrangler.toml
│   ├── package.json
│   └── tsconfig.json
└── docs/superpowers/specs/
    └── 2026-05-06-phase1-mvp-investor-portal-design.md   (this file)
```

## 11. Build and ship order

| # | Step | Effort |
|---|---|---|
| A | Backend Worker scaffold (D1 + SIWE + cron skeleton) | ~2 days |
| B | Frontend Settings + email subscription flow + SIWE | ~1 day |
| C | Frontend Dashboard (cards + recent activity) | ~1 day |
| D | i18n infrastructure (EN only) | ~0.5 day |
| E | Vesting page polish (curve, cards) | ~0.5 day |
| F | Email templates + Resend wiring | ~0.5 day |
| G | Manual E2E walkthrough on testnet | ~0.5 day |
|   | **Total** | **~6 days (~1 week)** |

## 12. Out of scope (explicit exclusions)

These are intentionally deferred to keep the MVP tight:

- **Staking page** — `CZMStaking` is not deployed for these investors yet, and SAFT investors do not need staking pre-TGE.
- **Buy / Trade page** — pre-sale is off-chain SAFT; no on-chain purchase flow.
- **veCZM, History page** — Phase 2 (post-TGE).
- **Admin web console** (BRD §13) — Hardhat scripts + BaseScan are sufficient at this scale.
- **Operator / Mining / VVB / Compliance portals** (BRD §14–17) — post-TGE.
- **Mobile native app** (BRD §18) — PWA from the responsive web app is sufficient.
- **Public API and SDKs** (BRD §19) — no external integration in MVP.
- **KYC oracle integration** (Sumsub / Persona / Chainalysis) — manual SAFT review.
- **Multisig admin and Timelock** — required before mainnet (separate workstream).
- **Formal accessibility audit** — basic alt text and ARIA labels only.
- **Multiple translated locales** — infrastructure is in place; only EN ships.

## 13. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| RPC rate limits cause cron to miss alerts | Low | Medium | 30 schedules × 24/day is well under public RPC limits; add fallback secondary RPC if it ever bites |
| Resend deliverability issues to corporate email | Medium | Low | Resend SPF/DKIM domain setup; investors can also see in-app banners |
| User signs SIWE on wrong network | Low | Low | SIWE message includes chainId; client checks before signing |
| Schedule data race (revoked between cron read and email) | Low | Low | Re-check `revoked` immediately before send (already in `maybeSend`) |
| Founder accidentally commits Resend key | Medium | High | `.env` already gitignored; secrets only via `wrangler secret put` |
| Cookie hijacking | Low | Medium | HttpOnly + Secure + SameSite=Lax; HMAC signature with rotated secret |

## 14. Open questions (none currently)

All scoping questions have been resolved during the brainstorming session preceding this document. If new questions arise during implementation, append them here and resolve before continuing.

---

## Approval

Approved by user on 2026-05-06 to proceed to implementation planning.

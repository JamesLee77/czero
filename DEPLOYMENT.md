# CZM Smart Contract Deployment Record

> Time-ordered record of deployed contract addresses, transaction hashes, and verification status.
> Update this document on every new deployment or migration.

---

## Phase 1 — Pre-sale Infrastructure (Base Sepolia Testnet)

### Network

| Item | Value |
|---|---|
| Chain | **Base Sepolia** |
| Chain ID | `84532` |
| RPC | `https://sepolia.base.org` |
| Explorer | https://sepolia.basescan.org |
| Deploy Date | **2026-05-06 (UTC)** |
| Solidity | `0.8.24` (Cancun EVM, optimizer 200 runs) |

### Deployer / Admin (Testnet Dev Key)

| Item | Value |
|---|---|
| Address | `0xB722843587DA96bdFb5638Bb0AbC8FC56a9dfa1D` |
| Roles | `DEFAULT_ADMIN_ROLE` + `MINTER_ROLE` + `PAUSER_ROLE` (Token), `SCHEDULE_MANAGER_ROLE` (Vesting) |
| Type | Single EOA — **TESTNET ONLY** |

> ⚠️ This key is for testnet only. At mainnet deploy, immediately replace with a multisig (Gnosis Safe 3-of-5).

### Deployed Contracts

| Contract | Address | BaseScan | Verify |
|---|---|---|---|
| **CZMToken v1.0.0** | `0x5b4319dB4b2949E921400D850838508BB8a510CE` | [view](https://sepolia.basescan.org/address/0x5b4319dB4b2949E921400D850838508BB8a510CE) | ✅ [code](https://sepolia.basescan.org/address/0x5b4319dB4b2949E921400D850838508BB8a510CE#code) |
| **CZMVesting** | `0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79` | [view](https://sepolia.basescan.org/address/0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79) | ✅ [code](https://sepolia.basescan.org/address/0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79#code) |

### Initial state (post-deploy snapshot)

#### CZMToken
- `name`: "C-ZERO Mining Token"
- `symbol`: "CZM"
- `decimals`: 18
- `cap`: 5,000,000,000 CZM
- `totalSupply`: 0 CZM (mint pending)
- `paused`: `false`

#### CZMVesting
- `czm`: `0x5b4319dB4b2949E921400D850838508BB8a510CE` (Token link verified)
- `getScheduleCount`: 0

---

## Operations (Phase 1)

### Pre-sale onboarding procedure

For each KYC-approved investor (small group):

```ts
// 1. Admin mints the investor's allocation to the Vesting contract
await token.mint("<vestingAddr>", amountInWei);

// 2. Admin creates the schedule (single or batch)
await vesting.createSchedule(
  investorAddr,    // beneficiary
  amountInWei,     // 18 decimals
  startTime,       // typically the sale-end timestamp
  cliffSeconds,    // e.g. 12 months = 31_536_000
  vestSeconds,     // e.g. 36 months = 94_608_000
  true             // revocable (so admin can redirect tokens for v2 migration)
);

// (or batch)
await vesting.createScheduleBatch(
  [a1, a2, a3], [amt1, amt2, amt3],
  startTime, cliffSeconds, vestSeconds, true
);
```

### Phase 2 migration preparation

When source code changes (Node/Mining, etc.) make a v2 necessary:
1. Deploy CZMTokenV2
2. Deploy CZMMigration (`scripts/deploy-migration.ts`)
3. v2.grantRole(MINTER_ROLE, migrationAddr)
4. Pre-sale holders call `migrate()` → v1 burned + v2 minted

---

## Mainnet pre-deployment checklist

| Item | Status |
|---|---|
| External audit (Trail of Bits / OZ / Quantstamp) | ❌ not done |
| Admin → Multisig (Gnosis Safe 3-of-5) | ❌ currently EOA |
| Timelock (48h) | ❌ not yet |
| Bug bounty (Immunefi) | ❌ not registered |
| KYC oracle integration | ❌ off-chain only |
| Pre-sale SAFT template + migration clause | ⚠️ separate legal review needed |
| Holder registry (off-chain DB) | ⚠️ to be set up before operations |

See [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md) for details.

---

## Pre-sale simulation (Base Sepolia, 2026-05-06)

`scripts/simulate-presale.ts` validated the full onboarding → claim → revoke flow on testnet.

### Scenario
- **Alice**: `0x048f42B850cC126468EE112852b6aC67e08e5d24` (random EOA, testnet only)
- Allocation: **1000 CZM**, cliff = 0, duration = 300s, revocable = true

### Steps and outcomes

| Step | Tx | Result |
|---|---|---|
| 1. Admin → alice 0.00002 ETH (gas) | [`0xf9de40…`](https://sepolia.basescan.org/tx/0xf9de40706a1c87c7676cf2ed1f4cb0de2ba2351cd8c3d41d2fae1c80a767b379) | ✅ |
| 2. Admin mints 1000 CZM → vesting | [`0x6dd160…`](https://sepolia.basescan.org/tx/0x6dd1600dfbaadec851a98ebb6acf6f33384f5c0ca185515d35df55d182b76c33) | totalSupply 0 → 1000 |
| 3. Admin createSchedule(alice, 1000, …) | [`0xd489ec…`](https://sepolia.basescan.org/tx/0xd489ec067d67f42b331ada4ffb3ff1ddb21a89c320a25a62d986c4f98985e647) | schedule id 0 |
| 4. Alice release() | [`0xeb7c80…`](https://sepolia.basescan.org/tx/0xeb7c80df2195dbb7b6923a531673924143bd40bf5f309ca113af6b050445a507) | alice +443.33 CZM |
| 5. Admin revoke(0) | [`0xc05518…`](https://sepolia.basescan.org/tx/0xc05518736161ca3df4806e85b6132f77dc6a25c4a6387fdaff472897bcba58ad) | alice +246.67, admin +310 |

### Final state
- **Alice**: 690 CZM (initial release + revoke-time vested portion)
- **Admin**: 310 CZM (refund)
- **Vesting balance**: 0 (fully distributed)
- **Total supply**: 1000 (unchanged)
- **Admin ETH spent**: ~0.000022 ETH (gas + alice gas-bootstrap)

### Verified behaviour
- ✅ Mint → Vesting isolation (lockup enforced)
- ✅ Cliff-then-linear vest
- ✅ Beneficiary can call release() directly
- ✅ Revoke pays vested portion to beneficiary, returns remainder to admin
- ✅ Accounting integrity: 690 + 310 = 1000

### Operational notes (testnet observations)
- **hardhat-ethers state caching**: `view` calls immediately after `tx.wait()` may return stale data. Solution: `POST_TX_DELAY_MS=4000` after each tx
- **estimateGas false underflow**: same caching issue — pass explicit `gasLimit` for every tx
- **Faucet drip is small**: 0.0001 ETH supports ~5 transactions (Base Sepolia gas is very cheap)

---

## Phase 2 Migration demo (Base Sepolia, 2026-05-06)

`scripts/simulate-migration.ts` validated the v1 → v2 swap flow on testnet.

### Additional deployment

| Contract | Address | Verify |
|---|---|---|
| **CZMToken v1.0.0 (v2 instance)** | [`0xC51AC33D23f7cCff7ddF83b751C52AF8ff50057c`](https://sepolia.basescan.org/address/0xC51AC33D23f7cCff7ddF83b751C52AF8ff50057c#code) | ✅ |
| **CZMMigration** (1:1, 30-day deadline) | [`0x1a3Fb22873fF0778069c7708A40E1CEA48Bb660c`](https://sepolia.basescan.org/address/0x1a3Fb22873fF0778069c7708A40E1CEA48Bb660c#code) | ✅ |

> For demonstration v2 reuses the CZMToken bytecode. In production v2 will be a different contract with new features (Node/Mining hooks, etc.).

### Setup steps

| Step | Tx | Result |
|---|---|---|
| Deploy v2 token | (deploy) | totalSupply 0 |
| Deploy Migration (v1, v2, bonus=0, deadline=30d) | (deploy) | initialised |
| `v2.grantRole(MINTER_ROLE, migration)` | [`0xde0b58…`](https://sepolia.basescan.org/tx/0xde0b58b20fd40ce6774e18d5ad1d840b2896f75f9bc4a96c21453b87acd964c6) | migration can mint v2 |

### Swap flow

| Step | Holder | Tx | Result |
|---|---|---|---|
| 1. alice.approve(migration, 690) | alice | [`0x41cd5a…`](https://sepolia.basescan.org/tx/0x41cd5a76e6d97a92943d93f4a203f44328d93be2c5af62136ec1046cc008ea58) | allowance 690 |
| 2. alice.migrate(690) | alice | [`0xbef484…`](https://sepolia.basescan.org/tx/0xbef484f12acd5d5b0ddacb4b51ab3b9adffe873fe3ab8c96071c8b9f45c273b1) | v1 burned 690, v2 minted 690 |
| 3. admin.approve(migration, 310) | admin | [`0x74c403…`](https://sepolia.basescan.org/tx/0x74c403652cdf24bac82590db8878204b3a903fc0186203829f45ef2a4b717fa3) | allowance 310 |
| 4. admin.migrate(310) | admin | [`0xf66c8d…`](https://sepolia.basescan.org/tx/0xf66c8ddf92c33c72e843cb9fbfb4b519d35d23b93b81bb88b650154a2dbc8d06) | v1 burned 310, v2 minted 310 |

### Final state

| Asset | Before | After |
|---|---|---|
| Alice v1 | 690 | **0** |
| Alice v2 | 0 | **690** |
| Admin v1 | 310 | **0** |
| Admin v2 | 0 | **310** |
| v1 totalSupply | 1000 | **0** (fully burned) |
| v2 totalSupply | 0 | **1000** (fully minted) |
| migration.totalMigrated | 0 | **1000** |

### Verified behaviour
- ✅ v1 burn (`burnFrom` via user approval)
- ✅ v2 mint (migration uses MINTER_ROLE)
- ✅ 1:1 ratio (bonusBps = 0)
- ✅ totalSupply integrity (v1 burned == v2 minted == 1000)
- ✅ Both EOA (alice) and Admin holders swap successfully
- ✅ CEI pattern (state-update before external call) — 0 Slither warnings

### Operational notes
- **Revoking MINTER_ROLE**: after migration ends, `v2.revokeRole(MINTER_ROLE, migration)` is recommended
- **Permit variant**: holders who want gasless approval can use `migrateWithPermit()` (verified by unit test)
- **Deadline expiry**: `migration.close()` can permanently disable migration

---

## Frontend Portal — Cloudflare Pages deployment

### Deployment info

| Item | Value |
|---|---|
| Hosting | **Cloudflare Pages** (Wrangler CLI) |
| Project | `czero-portal` |
| Account | `misterylee@gmail.com's Account` (id `e82458744ebc655e58fe5194e6fb93fd`) |
| Production URL | **https://czero-portal.pages.dev** |
| First deploy | 2026-05-06 |
| Stack | Vite 8 + React 18 + wagmi v2 + RainbowKit + Tailwind v4 |

### Re-deploy procedure

```bash
cd frontend
npm install
npm run build
CLOUDFLARE_ACCOUNT_ID=e82458744ebc655e58fe5194e6fb93fd \
  npx wrangler pages deploy dist --project-name=czero-portal --branch=main
```

Or one-liner (with env var preset):
```bash
cd frontend && npm run deploy
```

### One-time project creation (already done)

```bash
CLOUDFLARE_ACCOUNT_ID=... npx wrangler pages project create czero-portal --production-branch=main
```

### Environment variables (set in Cloudflare Dashboard)

Dashboard → Pages → czero-portal → Settings → Environment variables:
- `VITE_WALLETCONNECT_PROJECT_ID` (production — get from https://cloud.walletconnect.com)
- `NODE_VERSION = 20`

> Note: changing env vars requires **redeploy** (Vite inlines `import.meta.env` at build time)

### SPA routing

`frontend/public/_redirects` falls back all paths to `index.html` so React Router handles routing client-side.

---

## Phase 1 MVP — Investor Portal backend

| Item | Value |
|---|---|
| Worker | `czero-portal-api` (Cloudflare Worker) |
| Live URL | https://czero-portal-api.misterylee.workers.dev |
| Database | D1 `czero-portal-db` (id `a6d2557e-36f2-4723-bbf3-da39ef91fda6`) |
| Email provider | Resend (`RESEND_API_KEY` secret — placeholder until real key configured) |
| Cron | `0 * * * *` (hourly) — schedule scan + dedupe email |
| Auth | SIWE (EIP-4361) → HttpOnly session cookie (HMAC-SHA256, 7 days, SameSite=Strict) |

### API surface
- `POST /api/auth/nonce` / `POST /api/auth/verify` / `POST /api/auth/logout`
- `GET /api/me` / `PUT /api/me`
- `POST /api/me/email` / `DELETE /api/me/email`
- `GET /api/email/verify?token=…` (public)
- `scheduled` (cron — no HTTP)

### Re-deploy

```
cd backend
CLOUDFLARE_ACCOUNT_ID=e82458744ebc655e58fe5194e6fb93fd npx wrangler deploy

cd ../frontend
npm run build
CLOUDFLARE_ACCOUNT_ID=e82458744ebc655e58fe5194e6fb93fd npm run deploy
```

### Update Resend API key

Replace the placeholder before mass-emailing:
```
echo "<real_resend_api_key>" | CLOUDFLARE_ACCOUNT_ID=e82458744ebc655e58fe5194e6fb93fd npx wrangler secret put RESEND_API_KEY
```
(No redeploy needed — secrets pick up immediately.)

### E2E walkthrough

See `docs/superpowers/runbooks/2026-05-07-mvp-e2e-checklist.md` for the full post-deploy checklist.

---

## Change log

| Date | Change |
|---|---|
| 2026-05-06 | Phase 1 testnet deploy (CZMToken + CZMVesting), BaseScan verify complete |
| 2026-05-06 | Pre-sale simulation complete (mint / createSchedule / release / revoke) |
| 2026-05-06 | Phase 2 Migration demo complete (v1 1000 burn → v2 1000 mint, accounting verified) |
| 2026-05-06 | Frontend Portal deployed to Cloudflare Pages (https://czero-portal.pages.dev) |
| 2026-05-07 | Phase 1 MVP backend deployed (Cloudflare Worker + D1 + Resend + hourly cron); frontend extended with Dashboard/Settings + i18n infra |

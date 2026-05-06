# C-ZERO Portal

C-ZERO Mining Token (`$CZM`) investor portal — Vite 8 + React + wagmi + RainbowKit.

Pre-sale holders connect their wallet to view vesting schedules, claim vested tokens, and migrate from v1 to v2 when a new contract version ships.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Build | **Vite 8** (Rolldown bundler, ~10-30× faster) |
| Framework | React 18 + TypeScript (strict) + React Router v7 |
| Web3 | wagmi v2 + viem + @tanstack/react-query |
| Wallet UI | RainbowKit (MetaMask, Coinbase Wallet, WalletConnect, etc.) |
| Styling | Tailwind CSS v4 (Vite plugin) |
| Polyfills | `vite-plugin-node-polyfills` (Buffer/process for web3 deps) |
| Hosting | Cloudflare Pages (static + edge) |

---

## Local development

```bash
cp .env.example .env       # add your VITE_WALLETCONNECT_PROJECT_ID
npm install
npm run dev                # http://localhost:5173
npm run build              # production bundle to dist/
npm run preview            # preview the production build
npm run typecheck          # strict TS check, no emit
```

### Required env

```
VITE_WALLETCONNECT_PROJECT_ID=...   # get from https://cloud.walletconnect.com
# optional: override RPC endpoints
# VITE_BASE_SEPOLIA_RPC=https://sepolia.base.org
# VITE_BASE_RPC=https://mainnet.base.org
```

---

## Deployed contracts (Base Sepolia, testnet)

| Contract | Address |
|---|---|
| CZMToken v1 | `0x5b4319dB4b2949E921400D850838508BB8a510CE` |
| CZMVesting | `0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79` |
| CZMToken v2 | `0xC51AC33D23f7cCff7ddF83b751C52AF8ff50057c` |
| CZMMigration | `0x1a3Fb22873fF0778069c7708A40E1CEA48Bb660c` |

Addresses are wired in `src/lib/contracts.ts`. Mainnet addresses go under a separate `base` key once deployed.

---

## Cloudflare Pages deployment

### Option A — Git integration (recommended)

1. Push this repo to GitHub.
2. Open Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Select your repo. In **Build settings**:
   - **Framework preset**: Vite
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Build output directory**: `frontend/dist`
   - **Root directory** (advanced): leave empty
4. **Environment variables**:
   - `NODE_VERSION` = `20`
   - `VITE_WALLETCONNECT_PROJECT_ID` = `<your-id>`
   - (optional) `VITE_BASE_SEPOLIA_RPC`, `VITE_BASE_RPC`
5. **Save and Deploy**. Cloudflare creates a `*.pages.dev` URL and sets up auto-deploy on every push to `main`.

### Option B — Wrangler CLI

```bash
npm i -g wrangler
cd frontend
npm run build
wrangler pages deploy dist --project-name=czero-portal
```

### Custom domain

Cloudflare Pages → project → **Custom domains** → add (e.g. `portal.c-zero.io`). DNS auto-configures if the domain is on Cloudflare.

---

## Architecture

```
src/
├── main.tsx              # WagmiProvider + RainbowKitProvider + Router
├── App.tsx               # Route definitions
├── components/
│   └── Layout.tsx        # Header (nav + ConnectButton) + footer
├── pages/
│   ├── Home.tsx          # Token info + your balances
│   ├── Vesting.tsx       # Schedule list + Release button
│   └── Migrate.tsx       # Approve + Migrate (v1 → v2)
└── lib/
    ├── wagmi.ts          # Chains, transports, RainbowKit config
    ├── contracts.ts      # Addresses + minimal ABIs
    └── format.ts         # Display helpers
```

Each page derives its data with `useReadContract` / `useReadContracts` (auto-cached by react-query) and writes via `useWriteContract` + `useWaitForTransactionReceipt`.

---

## Known web3 + Vite gotchas (already handled)

- **`Buffer is not defined`** — `vite-plugin-node-polyfills` is configured in `vite.config.ts`.
- **WalletConnect process.env warnings** — harmless; ignore.
- **CSP for embedded iframes** — Cloudflare Pages defaults work for RainbowKit.

---

## Production checklist (before mainnet)

- [ ] Replace WalletConnect dev project with production id
- [ ] Add Base mainnet addresses to `src/lib/contracts.ts` under `base` key
- [ ] Set up custom domain + HSTS
- [ ] CSP header (Cloudflare → HTTP headers, restrict to wallet/RPC origins)
- [ ] Sentry / error tracking
- [ ] Analytics (privacy-respecting, e.g. Plausible)

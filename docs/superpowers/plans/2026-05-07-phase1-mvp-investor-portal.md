# Phase 1 MVP — Investor Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Cloudflare Worker backend (D1 + SIWE + cron) and extend the existing Vite/React portal with Dashboard + Settings + i18n so 10–30 SAFT investors can subscribe to email notifications, sign in with their wallet, and watch their on-chain vesting on Base Sepolia.

**Architecture:** A single Hono-based Cloudflare Worker exposes a small HTTP API (SIWE auth, profile, email subscription) and runs an hourly cron that reads every `CZMVesting` schedule from Base Sepolia, deduplicates against D1, and emails subscribers via Resend. The Vite frontend gains an i18n layer (react-i18next, EN only), an API client wired to the Worker, and two new pages (Dashboard, Settings) plus a polished Vesting page. Sessions are HttpOnly cookies signed via Web Crypto HMAC.

**Tech Stack:**
- Backend: TypeScript, Cloudflare Workers (Module syntax), Hono, viem (SIWE + RPC reads), Resend, Cloudflare D1, Web Crypto API
- Frontend: existing Vite 8 + React 18 + wagmi + RainbowKit + Tailwind v4, plus react-i18next, i18next-browser-languagedetector
- Test: `@cloudflare/vitest-pool-workers` for backend; manual + visual for frontend
- Deploy: `wrangler deploy` for backend, existing `npm run deploy` for frontend (Cloudflare Pages)

---

## Pre-flight (already in place, no code change)

- Smart contracts deployed and verified on Base Sepolia:
  - `CZMToken v1`: `0x5b4319dB4b2949E921400D850838508BB8a510CE`
  - `CZMVesting`:    `0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79`
  - `CZMToken v2`:   `0xC51AC33D23f7cCff7ddF83b751C52AF8ff50057c`
  - `CZMMigration`:  `0x1a3Fb22873fF0778069c7708A40E1CEA48Bb660c`
- Frontend deployed at `https://czero-portal.pages.dev` (Vite 8 + wagmi + RainbowKit MVP).
- Wrangler installed; account `misterylee@gmail.com` / id `e82458744ebc655e58fe5194e6fb93fd` already authenticated.

Set the following environment variable once per shell (used in commands below):
```
export CLOUDFLARE_ACCOUNT_ID=e82458744ebc655e58fe5194e6fb93fd
```

Resend account: create at https://resend.com (free tier covers 3000/month). Verify a sender domain or use the Resend onboarding sandbox `onboarding@resend.dev` for development.

---

## Task 1: Initialize the `backend/` Cloudflare Worker project

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.gitignore`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "czero-portal-backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "db:migrate:local": "wrangler d1 migrations apply czero-portal-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply czero-portal-db --remote"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "viem": "^2.21.0"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "@cloudflare/workers-types": "^4.20240909.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.5",
    "wrangler": "^4.88.0"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types/2023-07-01"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Create `backend/.gitignore`**

```
node_modules/
.wrangler/
*.log
.dev.vars
dist/
```

- [ ] **Step 4: Install dependencies**

Run from repo root:
```
cd backend && npm install
```

Expected: ~150 packages installed, no errors.

- [ ] **Step 5: Commit**

```bash
git checkout -b feat/backend-worker-scaffold
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/.gitignore
git commit -m "chore(backend): initialise Cloudflare Worker project"
```

---

## Task 2: Wrangler config + Worker skeleton

**Files:**
- Create: `backend/wrangler.toml`
- Create: `backend/src/index.ts`
- Create: `backend/src/types.ts`

- [ ] **Step 1: Create `backend/wrangler.toml`**

```toml
name = "czero-portal-api"
main = "src/index.ts"
compatibility_date = "2026-04-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ALLOWED_ORIGIN = "https://czero-portal.pages.dev"
RPC_URL = "https://sepolia.base.org"
CHAIN_ID = "84532"
CZM_VESTING_ADDRESS = "0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79"
APP_BASE_URL = "https://czero-portal.pages.dev"
RESEND_FROM = "C-ZERO Portal <onboarding@resend.dev>"

[[d1_databases]]
binding = "DB"
database_name = "czero-portal-db"
database_id = "REPLACE_WITH_REAL_ID_AFTER_CREATE"
migrations_dir = "migrations"

[triggers]
crons = ["0 * * * *"]

[dev]
port = 8787
```

- [ ] **Step 2: Create `backend/src/types.ts`**

```ts
export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  RPC_URL: string;
  CHAIN_ID: string;
  CZM_VESTING_ADDRESS: string;
  APP_BASE_URL: string;
  RESEND_FROM: string;
  RESEND_API_KEY: string; // secret
  SIWE_SECRET: string;    // secret
}

export interface SessionPayload {
  address: string; // lowercase
  exp: number;     // unix seconds
}

export interface UserRow {
  address: string;
  email: string | null;
  email_verified: number; // 0 | 1
  email_token: string | null;
  email_token_exp: number | null;
  notif_prefs: string;     // JSON
  language: string;
  created_at: number;
  updated_at: number;
}

export type NotificationKind = "cliff_7d" | "cliff_1d" | "claim_ready";
```

- [ ] **Step 3: Create `backend/src/index.ts` skeleton**

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const cors_ = cors({
    origin: c.env.ALLOWED_ORIGIN,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  });
  return cors_(c, next);
});

app.get("/health", (c) => c.json({ ok: true, service: "czero-portal-api" }));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext) {
    // populated in Task 14
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 4: Run dev server**

```
npx wrangler dev
```

Expected: starts on http://127.0.0.1:8787; `curl http://127.0.0.1:8787/health` returns `{"ok":true,"service":"czero-portal-api"}`. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add backend/wrangler.toml backend/src/index.ts backend/src/types.ts
git commit -m "feat(backend): Hono skeleton with /health and CORS"
```

---

## Task 3: D1 database creation + initial migration

**Files:**
- Create: `backend/migrations/0001_init.sql`
- Modify: `backend/wrangler.toml` (replace `database_id`)

- [ ] **Step 1: Create the database**

```
npx wrangler d1 create czero-portal-db
```

Expected: prints a UUID like `database_id = "abc1-..."`.

- [ ] **Step 2: Replace `database_id` in `backend/wrangler.toml`**

Edit the line:
```
database_id = "REPLACE_WITH_REAL_ID_AFTER_CREATE"
```
with the real UUID printed by Step 1.

- [ ] **Step 3: Create `backend/migrations/0001_init.sql`**

```sql
-- 0001 init
CREATE TABLE users (
  address          TEXT PRIMARY KEY,
  email            TEXT,
  email_verified   INTEGER NOT NULL DEFAULT 0,
  email_token      TEXT,
  email_token_exp  INTEGER,
  notif_prefs      TEXT NOT NULL DEFAULT '{"cliff_7d":true,"cliff_1d":true,"claim_ready":true}',
  language         TEXT NOT NULL DEFAULT 'en',
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE sent_notifications (
  address          TEXT NOT NULL,
  schedule_id      INTEGER NOT NULL,
  kind             TEXT NOT NULL,
  sent_at          INTEGER NOT NULL,
  PRIMARY KEY (address, schedule_id, kind)
);

CREATE TABLE auth_nonces (
  nonce            TEXT PRIMARY KEY,
  address          TEXT NOT NULL,
  expires_at       INTEGER NOT NULL
);

CREATE INDEX idx_auth_nonces_exp ON auth_nonces(expires_at);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
```

- [ ] **Step 4: Apply migration locally and remotely**

```
npm run db:migrate:local
npm run db:migrate:remote
```

Expected: "🚣 3 commands executed successfully" for both.

- [ ] **Step 5: Smoke-test via wrangler shell**

```
npx wrangler d1 execute czero-portal-db --local --command="SELECT name FROM sqlite_master WHERE type='table'"
```

Expected output lists `users`, `sent_notifications`, `auth_nonces`.

- [ ] **Step 6: Commit**

```bash
git add backend/migrations/0001_init.sql backend/wrangler.toml
git commit -m "feat(backend): D1 schema (users, sent_notifications, auth_nonces)"
```

---

## Task 4: Vitest + miniflare test harness

**Files:**
- Create: `backend/vitest.config.ts`
- Create: `backend/test/health.test.ts`

- [ ] **Step 1: Create `backend/vitest.config.ts`**

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          d1Databases: ["DB"],
          bindings: {
            ALLOWED_ORIGIN: "https://czero-portal.pages.dev",
            RPC_URL: "https://sepolia.base.org",
            CHAIN_ID: "84532",
            CZM_VESTING_ADDRESS: "0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79",
            APP_BASE_URL: "https://czero-portal.pages.dev",
            RESEND_FROM: "test@example.com",
            RESEND_API_KEY: "test_resend_key",
            SIWE_SECRET: "test_siwe_secret_at_least_32_chars_long_xx",
          },
        },
      },
    },
  },
});
```

- [ ] **Step 2: Create the failing test `backend/test/health.test.ts`**

```ts
import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("health", () => {
  it("GET /health returns ok", async () => {
    void env;
    const res = await SELF.fetch("http://localhost/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, service: "czero-portal-api" });
  });
});
```

- [ ] **Step 3: Run the test**

```
cd backend && npm test
```

Expected: PASS. (The skeleton from Task 2 already implements `/health`.)

- [ ] **Step 4: Commit**

```bash
git add backend/vitest.config.ts backend/test/health.test.ts
git commit -m "test(backend): vitest+miniflare harness with /health smoke test"
```

---

## Task 5: D1 access helpers (`db.ts`)

**Files:**
- Create: `backend/src/db.ts`
- Create: `backend/test/db.test.ts`

- [ ] **Step 1: Write failing test `backend/test/db.test.ts`**

```ts
import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { upsertUser, getUser, markSent, alreadySent } from "../src/db";

beforeEach(async () => {
  // @ts-expect-error: provided by cloudflare:test
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
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
```

Update `backend/vitest.config.ts` to include `TEST_MIGRATIONS`. Replace the `bindings` block in step 1's config — add at the end:

```ts
miniflare: {
  d1Databases: ["DB"],
  d1Persist: false,
  bindings: { /* same as before */ },
},
```

And add to `vitest.config.ts` imports:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
```

Add at bottom of file (replace existing `defineWorkersConfig({...})` block with this fuller version):

```ts
const initSql = readFileSync(resolve(__dirname, "migrations/0001_init.sql"), "utf-8");
const TEST_MIGRATIONS = [{ name: "0001_init", queries: initSql.split(/;\s*\n/).filter(Boolean) }];

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          d1Databases: ["DB"],
          d1Persist: false,
          bindings: {
            ALLOWED_ORIGIN: "https://czero-portal.pages.dev",
            RPC_URL: "https://sepolia.base.org",
            CHAIN_ID: "84532",
            CZM_VESTING_ADDRESS: "0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79",
            APP_BASE_URL: "https://czero-portal.pages.dev",
            RESEND_FROM: "test@example.com",
            RESEND_API_KEY: "test_resend_key",
            SIWE_SECRET: "test_siwe_secret_at_least_32_chars_long_xx",
            TEST_MIGRATIONS: JSON.stringify(TEST_MIGRATIONS),
          },
        },
      },
    },
  },
});
```

Then in `backend/test/db.test.ts` adjust the `applyD1Migrations` call:
```ts
const migrations = JSON.parse((env as any).TEST_MIGRATIONS);
await applyD1Migrations(env.DB, migrations);
```

- [ ] **Step 2: Run the failing test**

```
cd backend && npm test -- db.test
```

Expected: FAIL — `Cannot find module '../src/db'`.

- [ ] **Step 3: Implement `backend/src/db.ts`**

```ts
import type { UserRow, NotificationKind } from "./types";

export interface UpsertUserInput {
  email?: string | null;
  email_verified?: number;
  email_token?: string | null;
  email_token_exp?: number | null;
  notif_prefs?: string;
  language?: string;
}

export async function getUser(db: D1Database, address: string): Promise<UserRow | null> {
  const row = await db
    .prepare("SELECT * FROM users WHERE address = ?")
    .bind(address.toLowerCase())
    .first<UserRow>();
  return row ?? null;
}

export async function upsertUser(
  db: D1Database,
  address: string,
  input: UpsertUserInput,
  now: number,
): Promise<void> {
  const addr = address.toLowerCase();
  const existing = await getUser(db, addr);

  if (!existing) {
    await db
      .prepare(
        `INSERT INTO users (address, email, email_verified, email_token, email_token_exp, notif_prefs, language, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, COALESCE(?, '{"cliff_7d":true,"cliff_1d":true,"claim_ready":true}'), COALESCE(?, 'en'), ?, ?)`,
      )
      .bind(
        addr,
        input.email ?? null,
        input.email_verified ?? 0,
        input.email_token ?? null,
        input.email_token_exp ?? null,
        input.notif_prefs ?? null,
        input.language ?? null,
        now,
        now,
      )
      .run();
    return;
  }

  await db
    .prepare(
      `UPDATE users SET
         email           = COALESCE(?, email),
         email_verified  = COALESCE(?, email_verified),
         email_token     = ?,
         email_token_exp = ?,
         notif_prefs     = COALESCE(?, notif_prefs),
         language        = COALESCE(?, language),
         updated_at      = ?
       WHERE address = ?`,
    )
    .bind(
      input.email ?? null,
      input.email_verified ?? null,
      input.email_token ?? null,
      input.email_token_exp ?? null,
      input.notif_prefs ?? null,
      input.language ?? null,
      now,
      addr,
    )
    .run();
}

export async function clearEmail(db: D1Database, address: string, now: number): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET email=NULL, email_verified=0, email_token=NULL, email_token_exp=NULL, updated_at=? WHERE address=?`,
    )
    .bind(now, address.toLowerCase())
    .run();
}

export async function alreadySent(
  db: D1Database,
  address: string,
  scheduleId: number,
  kind: NotificationKind,
): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT 1 AS one FROM sent_notifications WHERE address = ? AND schedule_id = ? AND kind = ?",
    )
    .bind(address.toLowerCase(), scheduleId, kind)
    .first<{ one: number }>();
  return row !== null;
}

export async function markSent(
  db: D1Database,
  address: string,
  scheduleId: number,
  kind: NotificationKind,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO sent_notifications (address, schedule_id, kind, sent_at) VALUES (?, ?, ?, ?)`,
    )
    .bind(address.toLowerCase(), scheduleId, kind, now)
    .run();
}

export async function putNonce(
  db: D1Database,
  nonce: string,
  address: string,
  expiresAt: number,
): Promise<void> {
  await db
    .prepare("INSERT INTO auth_nonces (nonce, address, expires_at) VALUES (?, ?, ?)")
    .bind(nonce, address.toLowerCase(), expiresAt)
    .run();
}

export async function consumeNonce(
  db: D1Database,
  nonce: string,
  now: number,
): Promise<{ address: string } | null> {
  const row = await db
    .prepare("SELECT address, expires_at FROM auth_nonces WHERE nonce = ?")
    .bind(nonce)
    .first<{ address: string; expires_at: number }>();
  if (!row) return null;
  await db.prepare("DELETE FROM auth_nonces WHERE nonce = ?").bind(nonce).run();
  if (row.expires_at < now) return null;
  return { address: row.address };
}
```

- [ ] **Step 4: Re-run the test**

```
npm test -- db.test
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db.ts backend/test/db.test.ts backend/vitest.config.ts
git commit -m "feat(backend): D1 helpers for users, dedupe, nonces"
```

---

## Task 6: Session cookie HMAC

**Files:**
- Create: `backend/src/session.ts`
- Create: `backend/test/session.test.ts`

- [ ] **Step 1: Write failing test `backend/test/session.test.ts`**

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "../src/session";

describe("session", () => {
  it("sign + verify round-trip", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const cookie = await signSession(env.SIWE_SECRET, "0xabc", exp);
    const result = await verifySession(env.SIWE_SECRET, cookie);
    expect(result?.address).toBe("0xabc");
    expect(result?.exp).toBe(exp);
  });

  it("verifySession returns null for tampered payload", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const cookie = await signSession(env.SIWE_SECRET, "0xabc", exp);
    const tampered = cookie.replace("0xabc", "0xbad");
    expect(await verifySession(env.SIWE_SECRET, tampered)).toBeNull();
  });

  it("verifySession returns null when expired", async () => {
    const exp = Math.floor(Date.now() / 1000) - 1;
    const cookie = await signSession(env.SIWE_SECRET, "0xabc", exp);
    expect(await verifySession(env.SIWE_SECRET, cookie)).toBeNull();
  });

  it("verifySession returns null for malformed cookie", async () => {
    expect(await verifySession(env.SIWE_SECRET, "garbage")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the failing test**

```
npm test -- session.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `backend/src/session.ts`**

```ts
import type { SessionPayload } from "./types";

const ENC = new TextEncoder();
const DEC = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    ENC.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(
  secret: string,
  address: string,
  exp: number,
): Promise<string> {
  const payload: SessionPayload = { address: address.toLowerCase(), exp };
  const body = b64url(ENC.encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, ENC.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifySession(
  secret: string,
  cookie: string,
): Promise<SessionPayload | null> {
  const dot = cookie.indexOf(".");
  if (dot < 0) return null;
  const body = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const key = await importKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, fromB64url(sig), ENC.encode(body));
  if (!ok) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(DEC.decode(fromB64url(body)));
  } catch {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
```

- [ ] **Step 4: Re-run the test**

```
npm test -- session.test
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/session.ts backend/test/session.test.ts
git commit -m "feat(backend): HMAC-signed session cookies via Web Crypto"
```

---

## Task 7: SIWE auth — nonce + verify endpoints

**Files:**
- Create: `backend/src/auth.ts`
- Create: `backend/test/auth.test.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Write failing test `backend/test/auth.test.ts`**

```ts
import { env, SELF } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";

beforeEach(async () => {
  const migrations = JSON.parse((env as any).TEST_MIGRATIONS);
  await applyD1Migrations(env.DB, migrations);
});

describe("auth", () => {
  it("POST /api/auth/nonce returns nonce + message", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/nonce", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: "0x048f42B850cC126468EE112852b6aC67e08e5d24" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { nonce: string; message: string };
    expect(body.nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(body.message).toContain("0x048f42B850cC126468EE112852b6aC67e08e5d24");
    expect(body.message).toContain(body.nonce);
  });

  it("POST /api/auth/nonce rejects malformed address", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/nonce", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: "not-an-address" }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the failing test**

```
npm test -- auth.test
```

Expected: FAIL — endpoints not present (404).

- [ ] **Step 3: Implement `backend/src/auth.ts`**

```ts
import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { isAddress, verifyMessage } from "viem";
import type { Env } from "./types";
import { putNonce, consumeNonce, upsertUser } from "./db";
import { signSession } from "./session";

const SESSION_TTL_SEC = 7 * 24 * 60 * 60;     // 7 days
const NONCE_TTL_SEC = 5 * 60;                 // 5 min

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildSiweMessage(opts: {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
}): string {
  return [
    `${opts.domain} wants you to sign in with your Ethereum account:`,
    opts.address,
    "",
    "Sign in to the C-ZERO Investor Portal.",
    "",
    `URI: ${opts.uri}`,
    `Version: 1`,
    `Chain ID: ${opts.chainId}`,
    `Nonce: ${opts.nonce}`,
    `Issued At: ${opts.issuedAt}`,
  ].join("\n");
}

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.post("/nonce", async (c) => {
  const body = await c.req.json().catch(() => null);
  const address = body?.address;
  if (typeof address !== "string" || !isAddress(address)) {
    return c.json({ error: "INVALID_ADDRESS" }, 400);
  }
  const nonce = randomHex(16);
  const now = Math.floor(Date.now() / 1000);
  await putNonce(c.env.DB, nonce, address, now + NONCE_TTL_SEC);
  const url = new URL(c.env.APP_BASE_URL);
  const message = buildSiweMessage({
    domain: url.host,
    address,
    uri: c.env.APP_BASE_URL,
    chainId: parseInt(c.env.CHAIN_ID, 10),
    nonce,
    issuedAt: new Date(now * 1000).toISOString(),
  });
  return c.json({ nonce, message });
});

authRoutes.post("/verify", async (c) => {
  const body = await c.req.json().catch(() => null);
  const message: unknown = body?.message;
  const signature: unknown = body?.signature;
  if (typeof message !== "string" || typeof signature !== "string") {
    return c.json({ error: "INVALID_BODY" }, 400);
  }
  const nonceMatch = /^Nonce:\s*([a-f0-9]+)$/m.exec(message);
  const addrMatch = /^(0x[a-fA-F0-9]{40})$/m.exec(message);
  if (!nonceMatch || !addrMatch) {
    return c.json({ error: "INVALID_MESSAGE" }, 400);
  }
  const claimedAddress = addrMatch[1].toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const nonceRow = await consumeNonce(c.env.DB, nonceMatch[1], now);
  if (!nonceRow || nonceRow.address !== claimedAddress) {
    return c.json({ error: "INVALID_NONCE" }, 401);
  }
  const ok = await verifyMessage({
    address: addrMatch[1] as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  });
  if (!ok) return c.json({ error: "INVALID_SIGNATURE" }, 401);

  await upsertUser(c.env.DB, claimedAddress, {}, now);

  const exp = now + SESSION_TTL_SEC;
  const cookie = await signSession(c.env.SIWE_SECRET, claimedAddress, exp);
  setCookie(c, "siwe_session", cookie, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
  return c.json({ address: claimedAddress });
});

authRoutes.post("/logout", async (c) => {
  deleteCookie(c, "siwe_session", { path: "/" });
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Wire `authRoutes` into `backend/src/index.ts`**

Replace the file with:

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { authRoutes } from "./auth";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const cors_ = cors({
    origin: c.env.ALLOWED_ORIGIN,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  });
  return cors_(c, next);
});

app.get("/health", (c) => c.json({ ok: true, service: "czero-portal-api" }));
app.route("/api/auth", authRoutes);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext) {
    // populated in Task 14
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 5: Re-run the tests**

```
npm test -- auth.test
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth.ts backend/src/index.ts backend/test/auth.test.ts
git commit -m "feat(backend): SIWE nonce + verify + logout endpoints"
```

---

## Task 8: Auth middleware (require session)

**Files:**
- Create: `backend/src/middleware.ts`
- Create: `backend/test/middleware.test.ts`

- [ ] **Step 1: Write failing test `backend/test/middleware.test.ts`**

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { requireSession } from "../src/middleware";
import { signSession } from "../src/session";

function makeApp() {
  const app = new Hono<{ Bindings: typeof env; Variables: { address: string } }>();
  app.use("/protected/*", requireSession);
  app.get("/protected/me", (c) => c.json({ address: c.var.address }));
  return app;
}

describe("requireSession", () => {
  it("returns 401 when cookie missing", async () => {
    const res = await makeApp().fetch(new Request("http://x/protected/me"), env);
    expect(res.status).toBe(401);
  });

  it("returns 401 when cookie tampered", async () => {
    const cookie = await signSession(env.SIWE_SECRET, "0xabc", Math.floor(Date.now()/1000)+3600);
    const tampered = cookie.replace("0xabc", "0xbad");
    const res = await makeApp().fetch(
      new Request("http://x/protected/me", { headers: { cookie: `siwe_session=${tampered}` } }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("attaches lowercase address when cookie valid", async () => {
    const cookie = await signSession(env.SIWE_SECRET, "0xABC", Math.floor(Date.now()/1000)+3600);
    const res = await makeApp().fetch(
      new Request("http://x/protected/me", { headers: { cookie: `siwe_session=${cookie}` } }),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ address: "0xabc" });
  });
});
```

- [ ] **Step 2: Run the failing test**

```
npm test -- middleware.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `backend/src/middleware.ts`**

```ts
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Env } from "./types";
import { verifySession } from "./session";

export const requireSession = createMiddleware<{
  Bindings: Env;
  Variables: { address: string };
}>(async (c, next) => {
  const cookie = getCookie(c, "siwe_session");
  if (!cookie) return c.json({ error: "UNAUTHENTICATED" }, 401);
  const session = await verifySession(c.env.SIWE_SECRET, cookie);
  if (!session) return c.json({ error: "UNAUTHENTICATED" }, 401);
  c.set("address", session.address);
  await next();
});
```

- [ ] **Step 4: Re-run the test**

```
npm test -- middleware.test
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware.ts backend/test/middleware.test.ts
git commit -m "feat(backend): requireSession middleware"
```

---

## Task 9: User profile endpoints (`/api/me`)

**Files:**
- Create: `backend/src/me.ts`
- Create: `backend/test/me.test.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Write failing test `backend/test/me.test.ts`**

```ts
import { env, SELF } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { signSession } from "../src/session";
import { upsertUser } from "../src/db";

beforeEach(async () => {
  const migrations = JSON.parse((env as any).TEST_MIGRATIONS);
  await applyD1Migrations(env.DB, migrations);
});

async function authedFetch(path: string, init?: RequestInit, address = "0xabc") {
  const cookie = await signSession(env.SIWE_SECRET, address, Math.floor(Date.now() / 1000) + 3600);
  return SELF.fetch(`http://localhost${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), cookie: `siwe_session=${cookie}`, "content-type": "application/json" },
  });
}

describe("/api/me", () => {
  it("GET /api/me returns defaults for newly-authed user", async () => {
    await upsertUser(env.DB, "0xabc", {}, Math.floor(Date.now() / 1000));
    const res = await authedFetch("/api/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.address).toBe("0xabc");
    expect(body.email).toBeNull();
    expect(body.email_verified).toBe(false);
    expect(body.notif_prefs).toEqual({ cliff_7d: true, cliff_1d: true, claim_ready: true });
    expect(body.language).toBe("en");
  });

  it("PUT /api/me updates language and prefs", async () => {
    await upsertUser(env.DB, "0xabc", {}, Math.floor(Date.now() / 1000));
    const res = await authedFetch("/api/me", {
      method: "PUT",
      body: JSON.stringify({
        language: "ko",
        notif_prefs: { cliff_7d: false, cliff_1d: true, claim_ready: true },
      }),
    });
    expect(res.status).toBe(200);
    const fresh = await (await authedFetch("/api/me")).json() as Record<string, unknown>;
    expect(fresh.language).toBe("ko");
    expect(fresh.notif_prefs).toEqual({ cliff_7d: false, cliff_1d: true, claim_ready: true });
  });

  it("GET /api/me without cookie is 401", async () => {
    const res = await SELF.fetch("http://localhost/api/me");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the failing test**

```
npm test -- me.test
```

Expected: FAIL.

- [ ] **Step 3: Implement `backend/src/me.ts`**

```ts
import { Hono } from "hono";
import type { Env } from "./types";
import { requireSession } from "./middleware";
import { getUser, upsertUser } from "./db";

export const meRoutes = new Hono<{ Bindings: Env; Variables: { address: string } }>();

meRoutes.use("*", requireSession);

const VALID_LANGS = new Set(["en", "ko"]); // keep tight for now; expand as locales ship

meRoutes.get("/", async (c) => {
  const user = await getUser(c.env.DB, c.var.address);
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({
    address: user.address,
    email: user.email,
    email_verified: user.email_verified === 1,
    notif_prefs: JSON.parse(user.notif_prefs),
    language: user.language,
  });
});

meRoutes.put("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return c.json({ error: "INVALID_BODY" }, 400);

  const update: { notif_prefs?: string; language?: string } = {};

  if (body.language !== undefined) {
    if (typeof body.language !== "string" || !VALID_LANGS.has(body.language)) {
      return c.json({ error: "INVALID_LANGUAGE" }, 400);
    }
    update.language = body.language;
  }

  if (body.notif_prefs !== undefined) {
    const np = body.notif_prefs;
    if (
      !np || typeof np !== "object" ||
      typeof np.cliff_7d !== "boolean" ||
      typeof np.cliff_1d !== "boolean" ||
      typeof np.claim_ready !== "boolean"
    ) {
      return c.json({ error: "INVALID_NOTIF_PREFS" }, 400);
    }
    update.notif_prefs = JSON.stringify({
      cliff_7d: np.cliff_7d,
      cliff_1d: np.cliff_1d,
      claim_ready: np.claim_ready,
    });
  }

  await upsertUser(c.env.DB, c.var.address, update, Math.floor(Date.now() / 1000));
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Wire `meRoutes` into `backend/src/index.ts`**

Inside `backend/src/index.ts`, add:

```ts
import { meRoutes } from "./me";
// ... after existing app.route lines:
app.route("/api/me", meRoutes);
```

- [ ] **Step 5: Re-run tests**

```
npm test -- me.test
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/me.ts backend/src/index.ts backend/test/me.test.ts
git commit -m "feat(backend): /api/me GET + PUT (profile + prefs)"
```

---

## Task 10: Resend email client wrapper

**Files:**
- Create: `backend/src/email.ts`
- Create: `backend/test/email.test.ts`

- [ ] **Step 1: Write failing test `backend/test/email.test.ts`**

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, vi, afterEach } from "vitest";
import { sendEmail, renderEmailVerify, renderClaimReady, renderCliff7d, renderCliff1d } from "../src/email";

afterEach(() => vi.unstubAllGlobals());

describe("renderers", () => {
  it("renderEmailVerify produces a verify link with the token", () => {
    const { subject, html, text } = renderEmailVerify({
      appBaseUrl: "https://x.example",
      token: "abc123",
    });
    expect(subject).toMatch(/verify/i);
    expect(html).toContain("https://x.example/verify-email?token=abc123");
    expect(text).toContain("https://x.example/verify-email?token=abc123");
  });

  it("renderClaimReady includes amount and link", () => {
    const r = renderClaimReady({
      appBaseUrl: "https://x.example",
      releasable: "100",
      symbol: "CZM",
      scheduleId: 0,
    });
    expect(r.subject).toMatch(/ready to claim/i);
    expect(r.text).toContain("100 CZM");
  });

  it("renderCliff7d / renderCliff1d include unlock date", () => {
    const fmt = "2027-01-01";
    const a = renderCliff7d({ appBaseUrl: "https://x", unlockDate: fmt });
    const b = renderCliff1d({ appBaseUrl: "https://x", unlockDate: fmt });
    expect(a.text).toContain(fmt);
    expect(b.text).toContain(fmt);
  });
});

describe("sendEmail", () => {
  it("posts to Resend with API key", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "msg_x" }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const ok = await sendEmail({
      apiKey: env.RESEND_API_KEY,
      from: env.RESEND_FROM,
      to: "alice@example.com",
      subject: "hi",
      html: "<p>hi</p>",
      text: "hi",
    });
    expect(ok).toBe(true);

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("https://api.resend.com/emails");
    const init = call[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${env.RESEND_API_KEY}`);
  });

  it("returns false on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("err", { status: 500 })));
    const ok = await sendEmail({
      apiKey: "k",
      from: "a@b",
      to: "c@d",
      subject: "s",
      html: "h",
      text: "t",
    });
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the failing test**

```
npm test -- email.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `backend/src/email.ts`**

```ts
export interface SendEmailInput {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  return res.ok;
}

interface VerifyParams { appBaseUrl: string; token: string; }
export function renderEmailVerify({ appBaseUrl, token }: VerifyParams) {
  const url = `${appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return {
    subject: "Verify your C-ZERO portal email",
    html: `<p>Click to verify your email:</p><p><a href="${url}">${url}</a></p><p>This link expires in 24 hours.</p>`,
    text: `Verify your email: ${url}\nThis link expires in 24 hours.`,
  };
}

interface ClaimParams { appBaseUrl: string; releasable: string; symbol: string; scheduleId: number; }
export function renderClaimReady({ appBaseUrl, releasable, symbol, scheduleId }: ClaimParams) {
  const url = `${appBaseUrl}/vesting`;
  return {
    subject: `${releasable} ${symbol} ready to claim`,
    html: `<p>You have <strong>${releasable} ${symbol}</strong> ready to claim from schedule #${scheduleId}.</p>
           <p><a href="${url}">Open the portal</a> to release it.</p>`,
    text: `You have ${releasable} ${symbol} ready to claim from schedule #${scheduleId}. Open ${url}.`,
  };
}

interface CliffParams { appBaseUrl: string; unlockDate: string; }
export function renderCliff7d({ appBaseUrl, unlockDate }: CliffParams) {
  const url = `${appBaseUrl}/vesting`;
  return {
    subject: "Your CZM cliff ends in 7 days",
    html: `<p>Your CZM vesting cliff ends on <strong>${unlockDate}</strong>.</p>
           <p>After that, claimable tokens will start accruing linearly.</p>
           <p><a href="${url}">Open the portal</a>.</p>`,
    text: `Your CZM vesting cliff ends on ${unlockDate}. Open ${url}.`,
  };
}
export function renderCliff1d({ appBaseUrl, unlockDate }: CliffParams) {
  const url = `${appBaseUrl}/vesting`;
  return {
    subject: "Your CZM cliff ends tomorrow",
    html: `<p>Your CZM vesting cliff ends tomorrow (<strong>${unlockDate}</strong>).</p>
           <p><a href="${url}">Open the portal</a>.</p>`,
    text: `Your CZM vesting cliff ends tomorrow (${unlockDate}). Open ${url}.`,
  };
}
```

- [ ] **Step 4: Re-run the test**

```
npm test -- email.test
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/email.ts backend/test/email.test.ts
git commit -m "feat(backend): Resend email wrapper + 4 templates"
```

---

## Task 11: Email subscribe + verify endpoints

**Files:**
- Create: `backend/src/emailSub.ts`
- Modify: `backend/src/index.ts`
- Create: `backend/test/emailSub.test.ts`

- [ ] **Step 1: Write failing test `backend/test/emailSub.test.ts`**

```ts
import { env, SELF } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { signSession } from "../src/session";
import { upsertUser, getUser } from "../src/db";

beforeEach(async () => {
  const migrations = JSON.parse((env as any).TEST_MIGRATIONS);
  await applyD1Migrations(env.DB, migrations);
});
afterEach(() => vi.unstubAllGlobals());

async function authedFetch(path: string, init?: RequestInit, address = "0xabc") {
  const cookie = await signSession(env.SIWE_SECRET, address, Math.floor(Date.now()/1000)+3600);
  return SELF.fetch(`http://localhost${path}`, {
    ...init,
    headers: {...(init?.headers ?? {}), cookie: `siwe_session=${cookie}`, "content-type": "application/json"},
  });
}

describe("email subscribe", () => {
  it("POST /api/me/email stores token + sends verify email", async () => {
    await upsertUser(env.DB, "0xabc", {}, Math.floor(Date.now()/1000));
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await authedFetch("/api/me/email", {
      method: "POST",
      body: JSON.stringify({ email: "alice@example.com" }),
    });
    expect(res.status).toBe(200);
    const u = await getUser(env.DB, "0xabc");
    expect(u?.email).toBe("alice@example.com");
    expect(u?.email_verified).toBe(0);
    expect(u?.email_token).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("POST /api/me/email rejects malformed email", async () => {
    await upsertUser(env.DB, "0xabc", {}, Math.floor(Date.now()/1000));
    const res = await authedFetch("/api/me/email", {
      method: "POST",
      body: JSON.stringify({ email: "not-email" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/email/verify?token=... marks verified and clears token", async () => {
    const now = Math.floor(Date.now()/1000);
    await upsertUser(env.DB, "0xabc", {
      email: "alice@example.com",
      email_token: "tok123",
      email_token_exp: now + 3600,
    }, now);

    const res = await SELF.fetch(`http://localhost/api/email/verify?token=tok123`);
    expect(res.status).toBe(302); // redirect
    const u = await getUser(env.DB, "0xabc");
    expect(u?.email_verified).toBe(1);
    expect(u?.email_token).toBeNull();
  });

  it("GET /api/email/verify with bad token redirects with error", async () => {
    const res = await SELF.fetch(`http://localhost/api/email/verify?token=nope`);
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("emailVerified=error");
  });
});
```

- [ ] **Step 2: Run failing test**

```
npm test -- emailSub.test
```

Expected: FAIL.

- [ ] **Step 3: Implement `backend/src/emailSub.ts`**

```ts
import { Hono } from "hono";
import type { Env } from "./types";
import { requireSession } from "./middleware";
import { getUser, upsertUser, clearEmail } from "./db";
import { sendEmail, renderEmailVerify } from "./email";

const VERIFY_TTL_SEC = 24 * 60 * 60; // 24 hours

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailRoutes = new Hono<{ Bindings: Env; Variables: { address: string } }>();

emailRoutes.post("/", requireSession, async (c) => {
  const body = await c.req.json().catch(() => null);
  const email: unknown = body?.email;
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return c.json({ error: "INVALID_EMAIL" }, 400);
  }
  const now = Math.floor(Date.now() / 1000);
  const token = randomHex(24);

  await upsertUser(c.env.DB, c.var.address, {
    email,
    email_verified: 0,
    email_token: token,
    email_token_exp: now + VERIFY_TTL_SEC,
  }, now);

  const tpl = renderEmailVerify({ appBaseUrl: c.env.APP_BASE_URL, token });
  const ok = await sendEmail({
    apiKey: c.env.RESEND_API_KEY,
    from: c.env.RESEND_FROM,
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
  if (!ok) return c.json({ error: "EMAIL_SEND_FAILED" }, 502);
  return c.json({ ok: true });
});

emailRoutes.delete("/", requireSession, async (c) => {
  await clearEmail(c.env.DB, c.var.address, Math.floor(Date.now() / 1000));
  return c.json({ ok: true });
});

// Public verify endpoint — registered under /api/email/verify by index.ts
export const emailVerifyRoute = new Hono<{ Bindings: Env }>();
emailVerifyRoute.get("/verify", async (c) => {
  const token = c.req.query("token");
  const back = (suffix: string) => c.redirect(`${c.env.APP_BASE_URL}/settings?${suffix}`, 302);
  if (!token) return back("emailVerified=error");

  const now = Math.floor(Date.now() / 1000);
  const row = await c.env.DB
    .prepare("SELECT address, email_token_exp FROM users WHERE email_token = ?")
    .bind(token)
    .first<{ address: string; email_token_exp: number | null }>();

  if (!row || !row.email_token_exp || row.email_token_exp < now) {
    return back("emailVerified=error");
  }
  await upsertUser(c.env.DB, row.address, {
    email_verified: 1,
    email_token: null,
    email_token_exp: null,
  }, now);
  return back("emailVerified=ok");
});
```

- [ ] **Step 4: Wire routes in `backend/src/index.ts`**

Replace the file's body to register both:

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { authRoutes } from "./auth";
import { meRoutes } from "./me";
import { emailRoutes, emailVerifyRoute } from "./emailSub";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const cors_ = cors({
    origin: c.env.ALLOWED_ORIGIN,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  });
  return cors_(c, next);
});

app.get("/health", (c) => c.json({ ok: true, service: "czero-portal-api" }));
app.route("/api/auth", authRoutes);
app.route("/api/me", meRoutes);
app.route("/api/me/email", emailRoutes);
app.route("/api/email", emailVerifyRoute);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext) {
    // populated in Task 14
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 5: Re-run tests**

```
npm test -- emailSub.test
```

Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/emailSub.ts backend/src/index.ts backend/test/emailSub.test.ts
git commit -m "feat(backend): /api/me/email subscribe + /api/email/verify"
```

---

## Task 12: Chain reader (`chain.ts`) — vesting schedules

**Files:**
- Create: `backend/src/chain.ts`
- Create: `backend/test/chain.test.ts`

- [ ] **Step 1: Write failing test `backend/test/chain.test.ts`**

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, vi, afterEach } from "vitest";
import { readScheduleCount, readSchedule, readReleasable } from "../src/chain";

afterEach(() => vi.unstubAllGlobals());

function rpcMock(payload: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(payload), {
    status: 200, headers: { "content-type": "application/json" },
  }));
}

describe("chain", () => {
  it("readScheduleCount decodes uint256", async () => {
    vi.stubGlobal("fetch", rpcMock({ jsonrpc: "2.0", id: 1, result: "0x" + (5n).toString(16).padStart(64, "0") }));
    const n = await readScheduleCount(env);
    expect(n).toBe(5n);
  });

  it("readReleasable decodes uint256", async () => {
    vi.stubGlobal("fetch", rpcMock({ jsonrpc: "2.0", id: 1, result: "0x" + (123n).toString(16).padStart(64, "0") }));
    const r = await readReleasable(env, 0n);
    expect(r).toBe(123n);
  });

  it("readSchedule decodes the struct", async () => {
    // Build a synthetic ABI-encoded tuple
    const beneficiary = "0x048f42B850cC126468EE112852b6aC67e08e5d24";
    const total = 1000n;
    const start = 1_700_000_000n;
    const cliff = 0n;
    const dur = 300n;
    const released = 0n;
    const revocable = true;
    const revoked = false;
    const word = (v: bigint | string | boolean) => {
      if (typeof v === "boolean") return (v ? "1" : "0").padStart(64, "0");
      if (typeof v === "string") return v.toLowerCase().replace("0x", "").padStart(64, "0");
      return v.toString(16).padStart(64, "0");
    };
    const result =
      "0x" +
      word(beneficiary) +
      word(total) +
      word(start) +
      word(cliff) +
      word(dur) +
      word(released) +
      word(revocable) +
      word(revoked);
    vi.stubGlobal("fetch", rpcMock({ jsonrpc: "2.0", id: 1, result }));

    const s = await readSchedule(env, 0n);
    expect(s.beneficiary.toLowerCase()).toBe(beneficiary.toLowerCase());
    expect(s.totalAmount).toBe(total);
    expect(s.startTime).toBe(start);
    expect(s.cliffDuration).toBe(cliff);
    expect(s.vestingDuration).toBe(dur);
    expect(s.released).toBe(released);
    expect(s.revocable).toBe(true);
    expect(s.revoked).toBe(false);
  });
});
```

- [ ] **Step 2: Run failing test**

```
npm test -- chain.test
```

Expected: FAIL.

- [ ] **Step 3: Implement `backend/src/chain.ts`**

```ts
import { createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import type { Env } from "./types";

export interface VestingSchedule {
  beneficiary: `0x${string}`;
  totalAmount: bigint;
  startTime: bigint;
  cliffDuration: bigint;
  vestingDuration: bigint;
  released: bigint;
  revocable: boolean;
  revoked: boolean;
}

const VESTING_ABI = parseAbi([
  "function getScheduleCount() view returns (uint256)",
  "function schedules(uint256) view returns (address beneficiary, uint256 totalAmount, uint256 startTime, uint256 cliffDuration, uint256 vestingDuration, uint256 released, bool revocable, bool revoked)",
  "function releasable(uint256) view returns (uint256)",
]);

function makeClient(env: Env) {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(env.RPC_URL),
  });
}

export async function readScheduleCount(env: Env): Promise<bigint> {
  const client = makeClient(env);
  return await client.readContract({
    address: env.CZM_VESTING_ADDRESS as `0x${string}`,
    abi: VESTING_ABI,
    functionName: "getScheduleCount",
  });
}

export async function readSchedule(env: Env, id: bigint): Promise<VestingSchedule> {
  const client = makeClient(env);
  const [beneficiary, totalAmount, startTime, cliffDuration, vestingDuration, released, revocable, revoked] =
    (await client.readContract({
      address: env.CZM_VESTING_ADDRESS as `0x${string}`,
      abi: VESTING_ABI,
      functionName: "schedules",
      args: [id],
    })) as readonly [`0x${string}`, bigint, bigint, bigint, bigint, bigint, boolean, boolean];
  return { beneficiary, totalAmount, startTime, cliffDuration, vestingDuration, released, revocable, revoked };
}

export async function readReleasable(env: Env, id: bigint): Promise<bigint> {
  const client = makeClient(env);
  return (await client.readContract({
    address: env.CZM_VESTING_ADDRESS as `0x${string}`,
    abi: VESTING_ABI,
    functionName: "releasable",
    args: [id],
  })) as bigint;
}
```

- [ ] **Step 4: Re-run tests**

```
npm test -- chain.test
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/chain.ts backend/test/chain.test.ts
git commit -m "feat(backend): viem-based vesting schedule reader"
```

---

## Task 13: Format helpers for emails

**Files:**
- Create: `backend/src/format.ts`
- Create: `backend/test/format.test.ts`

- [ ] **Step 1: Write failing test `backend/test/format.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { formatCZM, formatUnlockDate } from "../src/format";

describe("format", () => {
  it("formatCZM formats 1e18 wei as '1'", () => {
    expect(formatCZM(10n ** 18n)).toBe("1");
  });
  it("formatCZM formats 1.234 with 4dp default", () => {
    expect(formatCZM(1234n * 10n ** 15n)).toBe("1.234");
  });
  it("formatCZM caps to maxFractionDigits", () => {
    expect(formatCZM(1234567890123456789n, 2)).toBe("1.23");
  });
  it("formatUnlockDate produces YYYY-MM-DD UTC", () => {
    expect(formatUnlockDate(1_700_000_000n)).toBe("2023-11-14");
  });
});
```

- [ ] **Step 2: Run failing test**

```
npm test -- format.test
```

Expected: FAIL.

- [ ] **Step 3: Implement `backend/src/format.ts`**

```ts
import { formatUnits } from "viem";

export function formatCZM(amount: bigint, maxFractionDigits = 4): string {
  const s = formatUnits(amount, 18);
  const num = Number(s);
  if (!Number.isFinite(num)) return s;
  return num.toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  });
}

export function formatUnlockDate(unixSeconds: bigint): string {
  const d = new Date(Number(unixSeconds) * 1000);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Re-run test**

```
npm test -- format.test
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/format.ts backend/test/format.test.ts
git commit -m "feat(backend): formatCZM + formatUnlockDate helpers"
```

---

## Task 14: Cron handler — schedule scan + dedup + email

**Files:**
- Create: `backend/src/scheduled.ts`
- Create: `backend/test/scheduled.test.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Write failing test `backend/test/scheduled.test.ts`**

```ts
import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { runScheduled } from "../src/scheduled";
import { upsertUser, alreadySent } from "../src/db";
import * as chain from "../src/chain";
import * as email from "../src/email";

const ALICE = "0x048f42b850cc126468ee112852b6ac67e08e5d24";

beforeEach(async () => {
  const migrations = JSON.parse((env as any).TEST_MIGRATIONS);
  await applyD1Migrations(env.DB, migrations);
});
afterEach(() => vi.restoreAllMocks());

describe("runScheduled", () => {
  it("sends claim_ready when releasable > 0 and user verified", async () => {
    const now = 1_800_000_000;
    await upsertUser(env.DB, ALICE, {
      email: "alice@example.com",
      email_verified: 1,
    }, now);

    vi.spyOn(chain, "readScheduleCount").mockResolvedValue(1n);
    vi.spyOn(chain, "readSchedule").mockResolvedValue({
      beneficiary: ALICE as `0x${string}`,
      totalAmount: 1_000n * 10n ** 18n,
      startTime: BigInt(now - 3600),
      cliffDuration: 0n,
      vestingDuration: 7200n,
      released: 0n,
      revocable: false,
      revoked: false,
    });
    vi.spyOn(chain, "readReleasable").mockResolvedValue(500n * 10n ** 18n);
    const sendMock = vi.spyOn(email, "sendEmail").mockResolvedValue(true);

    await runScheduled(env, () => now);

    expect(sendMock).toHaveBeenCalledOnce();
    const arg = sendMock.mock.calls[0][0];
    expect(arg.subject).toMatch(/ready to claim/i);
    expect(await alreadySent(env.DB, ALICE, 0, "claim_ready")).toBe(true);
  });

  it("skips revoked schedules", async () => {
    await upsertUser(env.DB, ALICE, { email: "alice@example.com", email_verified: 1 }, 100);
    vi.spyOn(chain, "readScheduleCount").mockResolvedValue(1n);
    vi.spyOn(chain, "readSchedule").mockResolvedValue({
      beneficiary: ALICE as `0x${string}`,
      totalAmount: 1n,
      startTime: 0n,
      cliffDuration: 0n,
      vestingDuration: 1n,
      released: 0n,
      revocable: true,
      revoked: true,
    });
    const sendMock = vi.spyOn(email, "sendEmail").mockResolvedValue(true);
    await runScheduled(env, () => 1_900_000_000);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("dedupes — second run does not resend", async () => {
    const now = 1_800_000_000;
    await upsertUser(env.DB, ALICE, { email: "alice@example.com", email_verified: 1 }, now);
    vi.spyOn(chain, "readScheduleCount").mockResolvedValue(1n);
    vi.spyOn(chain, "readSchedule").mockResolvedValue({
      beneficiary: ALICE as `0x${string}`,
      totalAmount: 1_000n,
      startTime: BigInt(now - 100),
      cliffDuration: 0n,
      vestingDuration: 200n,
      released: 0n,
      revocable: false,
      revoked: false,
    });
    vi.spyOn(chain, "readReleasable").mockResolvedValue(500n);
    const sendMock = vi.spyOn(email, "sendEmail").mockResolvedValue(true);

    await runScheduled(env, () => now);
    await runScheduled(env, () => now + 60);
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("respects notif_prefs (claim_ready=false → no send)", async () => {
    const now = 1_800_000_000;
    await upsertUser(env.DB, ALICE, {
      email: "alice@example.com",
      email_verified: 1,
      notif_prefs: JSON.stringify({ cliff_7d: true, cliff_1d: true, claim_ready: false }),
    }, now);
    vi.spyOn(chain, "readScheduleCount").mockResolvedValue(1n);
    vi.spyOn(chain, "readSchedule").mockResolvedValue({
      beneficiary: ALICE as `0x${string}`,
      totalAmount: 1n,
      startTime: BigInt(now - 100),
      cliffDuration: 0n,
      vestingDuration: 200n,
      released: 0n,
      revocable: false,
      revoked: false,
    });
    vi.spyOn(chain, "readReleasable").mockResolvedValue(1n);
    const sendMock = vi.spyOn(email, "sendEmail").mockResolvedValue(true);
    await runScheduled(env, () => now);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends cliff_7d when 7 days away", async () => {
    const now = 1_800_000_000;
    const sevenDays = 7 * 24 * 60 * 60;
    await upsertUser(env.DB, ALICE, { email: "alice@example.com", email_verified: 1 }, now);
    vi.spyOn(chain, "readScheduleCount").mockResolvedValue(1n);
    vi.spyOn(chain, "readSchedule").mockResolvedValue({
      beneficiary: ALICE as `0x${string}`,
      totalAmount: 1n,
      startTime: BigInt(now),
      cliffDuration: BigInt(sevenDays),
      vestingDuration: BigInt(sevenDays * 4),
      released: 0n,
      revocable: false,
      revoked: false,
    });
    vi.spyOn(chain, "readReleasable").mockResolvedValue(0n);
    const sendMock = vi.spyOn(email, "sendEmail").mockResolvedValue(true);
    await runScheduled(env, () => now);
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock.mock.calls[0][0].subject).toMatch(/cliff ends in 7 days/i);
  });
});
```

- [ ] **Step 2: Run failing test**

```
npm test -- scheduled.test
```

Expected: FAIL.

- [ ] **Step 3: Implement `backend/src/scheduled.ts`**

```ts
import type { Env, NotificationKind } from "./types";
import { readScheduleCount, readSchedule, readReleasable } from "./chain";
import { getUser, alreadySent, markSent } from "./db";
import {
  sendEmail,
  renderClaimReady,
  renderCliff7d,
  renderCliff1d,
} from "./email";
import { formatCZM, formatUnlockDate } from "./format";

const DAY = 86_400n;
const HALF_DAY = DAY / 2n;
const SEVEN_DAYS = 7n * DAY;

type Now = () => number;

export async function runScheduled(env: Env, now: Now = () => Math.floor(Date.now() / 1000)) {
  const count = await readScheduleCount(env);
  for (let id = 0n; id < count; id++) {
    try {
      await processOne(env, id, now);
    } catch (e) {
      console.error("scheduled:", id, e);
    }
  }
}

async function processOne(env: Env, id: bigint, now: Now) {
  const s = await readSchedule(env, id);
  if (s.revoked) return;
  const user = await getUser(env.DB, s.beneficiary);
  if (!user || !user.email || user.email_verified !== 1) return;
  const prefs = JSON.parse(user.notif_prefs) as Record<NotificationKind, boolean>;

  const cliffEnd = s.startTime + s.cliffDuration;
  const dt = cliffEnd - BigInt(now());

  if (prefs.cliff_7d && dt > (SEVEN_DAYS - HALF_DAY) && dt <= (SEVEN_DAYS + HALF_DAY)) {
    await maybeSend(env, user.address, Number(id), "cliff_7d", () =>
      renderCliff7d({ appBaseUrl: env.APP_BASE_URL, unlockDate: formatUnlockDate(cliffEnd) }),
      user.email!, now,
    );
  }

  if (prefs.cliff_1d && dt > (DAY - HALF_DAY) && dt <= (DAY + HALF_DAY)) {
    await maybeSend(env, user.address, Number(id), "cliff_1d", () =>
      renderCliff1d({ appBaseUrl: env.APP_BASE_URL, unlockDate: formatUnlockDate(cliffEnd) }),
      user.email!, now,
    );
  }

  if (prefs.claim_ready) {
    const releasable = await readReleasable(env, id);
    if (releasable > 0n) {
      await maybeSend(env, user.address, Number(id), "claim_ready", () =>
        renderClaimReady({
          appBaseUrl: env.APP_BASE_URL,
          releasable: formatCZM(releasable),
          symbol: "CZM",
          scheduleId: Number(id),
        }),
        user.email!, now,
      );
    }
  }
}

async function maybeSend(
  env: Env,
  address: string,
  scheduleId: number,
  kind: NotificationKind,
  render: () => { subject: string; html: string; text: string },
  email: string,
  now: Now,
) {
  if (await alreadySent(env.DB, address, scheduleId, kind)) return;
  const tpl = render();
  const ok = await sendEmail({
    apiKey: env.RESEND_API_KEY,
    from: env.RESEND_FROM,
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
  if (ok) await markSent(env.DB, address, scheduleId, kind, now());
}
```

- [ ] **Step 4: Wire into `backend/src/index.ts`**

Replace the `scheduled` handler:

```ts
import { runScheduled } from "./scheduled";

// inside the default export:
async scheduled(_event, env, ctx) {
  ctx.waitUntil(runScheduled(env));
}
```

- [ ] **Step 5: Run all tests**

```
npm test
```

Expected: every test passes (5 + 3 + 2 + 4 + 3 + 5 + 4 + 5 = 31 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/scheduled.ts backend/src/index.ts backend/test/scheduled.test.ts
git commit -m "feat(backend): hourly cron — cliff_7d/cliff_1d/claim_ready w/ dedupe"
```

---

## Task 15: Backend deploy — D1 + secrets + first deploy

**Files:**
- (no source changes)

- [ ] **Step 1: Set required secrets**

```
cd backend
echo "<your_resend_api_key>" | npx wrangler secret put RESEND_API_KEY
openssl rand -hex 32 | npx wrangler secret put SIWE_SECRET
```

Expected: each prints `✨  Success! Uploaded secret …`.

- [ ] **Step 2: Deploy the Worker**

```
npx wrangler deploy
```

Expected: prints something like `Published czero-portal-api … <url>.workers.dev`. Capture the URL.

- [ ] **Step 3: Smoke-test live `/health`**

```
curl https://czero-portal-api.<account>.workers.dev/health
```

Expected: `{"ok":true,"service":"czero-portal-api"}`.

- [ ] **Step 4: Trigger the cron once manually for sanity**

```
npx wrangler tail
```

(Leave running.) In another shell:
```
curl https://czero-portal-api.<account>.workers.dev/__scheduled?cron=0+%2A+%2A+%2A+%2A
```

Expected: tail prints "scheduled:" log entries (no errors). Stop both with Ctrl+C.

- [ ] **Step 5: Commit (no source change — note the deploy)**

```bash
git commit --allow-empty -m "ops(backend): first Worker deploy + secrets configured"
```

---

## Task 16: Frontend — i18n setup + en.json

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/i18n.ts`
- Create: `frontend/src/locales/en.json`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Add dependencies**

```
cd frontend
npm install i18next react-i18next i18next-browser-languagedetector
```

- [ ] **Step 2: Create `frontend/src/locales/en.json`**

```json
{
  "common": {
    "connect": "Connect Wallet",
    "loading": "Loading…",
    "save": "Save",
    "cancel": "Cancel",
    "back": "Back",
    "ok": "OK",
    "error": "Something went wrong"
  },
  "nav": {
    "overview": "Overview",
    "dashboard": "Dashboard",
    "vesting": "Vesting",
    "settings": "Settings",
    "migrate": "Migrate"
  },
  "home": {
    "title": "C-ZERO Mining Token",
    "subtitle": "Pre-sale investor portal. Connect your wallet to view vesting schedules and migrate tokens between contract versions."
  },
  "dashboard": {
    "title": "Dashboard",
    "cards": {
      "totalBalance": "Total CZM",
      "nextUnlock": "Next Unlock",
      "claimable": "Currently Claimable",
      "migration": "Migration Status"
    },
    "noNextUnlock": "No upcoming unlocks",
    "recentActivity": "Recent activity",
    "noActivity": "No activity yet"
  },
  "vesting": {
    "title": "Your vesting schedules",
    "subtitle": "Pre-sale allocations are locked here until cliff + linear vest.",
    "noSchedules": "No vesting schedules found for this address.",
    "release": "Release {{amount}} CZM",
    "awaitingWallet": "Awaiting wallet…",
    "confirming": "Confirming…",
    "fields": {
      "total": "Total",
      "released": "Released",
      "releasable": "Releasable now",
      "start": "Start",
      "cliffEnds": "Cliff ends",
      "fullyVested": "Fully vested"
    },
    "released": "Release confirmed. Tokens are in your wallet."
  },
  "settings": {
    "title": "Settings",
    "wallet": {
      "title": "Wallet",
      "connected": "Connected as",
      "disconnect": "Disconnect"
    },
    "signIn": {
      "title": "Sign in",
      "description": "Sign a message with your wallet to view and manage your portal preferences.",
      "button": "Sign in with Ethereum",
      "signing": "Signing…"
    },
    "email": {
      "title": "Email notifications",
      "description": "Get notified when your CZM cliff ends or new tokens are claimable.",
      "placeholder": "you@example.com",
      "subscribe": "Subscribe",
      "subscribed": "Subscribed as",
      "verified": "Verified",
      "unverified": "Pending verification — check your inbox.",
      "remove": "Remove email"
    },
    "prefs": {
      "title": "Notification preferences",
      "cliff_7d": "Cliff ends in 7 days",
      "cliff_1d": "Cliff ends tomorrow",
      "claim_ready": "Tokens ready to claim"
    },
    "language": {
      "title": "Language",
      "en": "English"
    },
    "verified": "Email verified.",
    "verifyError": "Verification link is invalid or expired."
  },
  "migrate": {
    "title": "Migrate v1 → v2",
    "description": "Burns your v1 CZM and mints the same amount of v2 CZM 1:1."
  }
}
```

- [ ] **Step 3: Create `frontend/src/lib/i18n.ts`**

```ts
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en"], // expand here when locales are translated (e.g. "ko", "ja")
    resources: {
      en: { translation: en.common, common: en.common, nav: en.nav, home: en.home,
            dashboard: en.dashboard, vesting: en.vesting, settings: en.settings, migrate: en.migrate },
    },
    ns: ["common", "nav", "home", "dashboard", "vesting", "settings", "migrate"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });

export default i18n;
```

- [ ] **Step 4: Wire into `frontend/src/main.tsx`**

Add at top of file, just below the existing imports:

```ts
import "./lib/i18n";
```

- [ ] **Step 5: Build to confirm no type / runtime breakage**

```
cd frontend && npm run build
```

Expected: `✓ built in <time>`.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/i18n.ts frontend/src/locales/en.json frontend/src/main.tsx
git commit -m "feat(frontend): react-i18next setup with English bundle"
```

---

## Task 17: Frontend — API client wrapper

**Files:**
- Modify: `frontend/.env.example`
- Modify: `frontend/src/vite-env.d.ts`
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add `VITE_API_BASE_URL` to `.env.example`**

Append to `frontend/.env.example`:
```
# Worker base URL (deployed in backend/)
VITE_API_BASE_URL=https://czero-portal-api.<account>.workers.dev
```

- [ ] **Step 2: Update `frontend/src/vite-env.d.ts`**

Replace contents with:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_BASE_SEPOLIA_RPC?: string;
  readonly VITE_BASE_RPC?: string;
  readonly VITE_API_BASE_URL?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
```

- [ ] **Step 3: Create `frontend/src/lib/api.ts`**

```ts
const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const code = body && typeof body === "object" && "error" in body ? String((body as Record<string, unknown>).error) : undefined;
    throw new ApiError(`${res.status} ${path}`, res.status, code);
  }
  return body as T;
}

export interface MeResponse {
  address: string;
  email: string | null;
  email_verified: boolean;
  notif_prefs: { cliff_7d: boolean; cliff_1d: boolean; claim_ready: boolean };
  language: string;
}

export const api = {
  authNonce: (address: string) =>
    request<{ nonce: string; message: string }>("/api/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ address }),
    }),
  authVerify: (message: string, signature: string) =>
    request<{ address: string }>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ message, signature }),
    }),
  authLogout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: () => request<MeResponse>("/api/me"),
  updateMe: (input: Partial<Pick<MeResponse, "language" | "notif_prefs">>) =>
    request<{ ok: true }>("/api/me", { method: "PUT", body: JSON.stringify(input) }),
  subscribeEmail: (email: string) =>
    request<{ ok: true }>("/api/me/email", { method: "POST", body: JSON.stringify({ email }) }),
  unsubscribeEmail: () =>
    request<{ ok: true }>("/api/me/email", { method: "DELETE" }),
};
```

- [ ] **Step 4: Build**

```
npm run build
```

Expected: `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add frontend/.env.example frontend/src/vite-env.d.ts frontend/src/lib/api.ts
git commit -m "feat(frontend): typed API client (cookie-based, fetch wrapper)"
```

---

## Task 18: Frontend — SIWE sign-in hook

**Files:**
- Create: `frontend/src/lib/siwe.ts`
- Create: `frontend/src/hooks/useSession.ts`

- [ ] **Step 1: Create `frontend/src/lib/siwe.ts`**

```ts
import { api, ApiError } from "./api";
import type { WalletClient } from "viem";

export async function signInWithEthereum(opts: {
  walletClient: WalletClient;
  address: `0x${string}`;
}): Promise<void> {
  const { nonce: _nonce, message } = await api.authNonce(opts.address);
  void _nonce; // contained inside `message` for verification
  const signature = await opts.walletClient.signMessage({ account: opts.address, message });
  try {
    await api.authVerify(message, signature);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      throw new Error("Signature rejected. Please try again.");
    }
    throw e;
  }
}
```

- [ ] **Step 2: Create `frontend/src/hooks/useSession.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import type { Address } from "viem";
import { api, ApiError, type MeResponse } from "../lib/api";
import { signInWithEthereum } from "../lib/siwe";

export function useSession() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const m = await api.me();
      setMe(m);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
      else throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh, address]);

  const signIn = useCallback(async () => {
    if (!address || !walletClient) return;
    setSigning(true);
    setError(null);
    try {
      await signInWithEthereum({ walletClient, address: address as Address });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setSigning(false);
    }
  }, [address, walletClient, refresh]);

  const signOut = useCallback(async () => {
    await api.authLogout();
    setMe(null);
  }, []);

  return { isConnected, address, me, loading, signing, error, signIn, signOut, refresh };
}
```

- [ ] **Step 3: Build**

```
npm run build
```

Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/siwe.ts frontend/src/hooks/useSession.ts
git commit -m "feat(frontend): SIWE sign-in hook (useSession)"
```

---

## Task 19: Frontend — Settings page

**Files:**
- Create: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Create `frontend/src/pages/Settings.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { api } from "../lib/api";
import { useSession } from "../hooks/useSession";
import { shortAddress } from "../lib/format";

export default function Settings() {
  const { t } = useTranslation(["settings", "common"]);
  const { isConnected } = useAccount();
  const { me, signing, signIn, signOut, refresh, error } = useSession();
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [params] = useSearchParams();
  const verifiedFlash = params.get("emailVerified");

  useEffect(() => {
    if (me?.email) setEmailInput(me.email);
  }, [me?.email]);

  if (!isConnected) {
    return <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 text-center">{t("common:connect")}</div>;
  }

  if (!me) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 space-y-3">
        <h2 className="text-lg font-semibold">{t("settings:signIn.title")}</h2>
        <p className="text-sm text-neutral-400">{t("settings:signIn.description")}</p>
        <button
          onClick={() => void signIn()}
          disabled={signing}
          className="rounded-md bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 disabled:opacity-50 transition"
        >
          {signing ? t("settings:signIn.signing") : t("settings:signIn.button")}
        </button>
        {error && <p className="text-sm text-red-300">{error}</p>}
      </section>
    );
  }

  async function subscribe() {
    setSaving(true);
    try {
      await api.subscribeEmail(emailInput);
      await refresh();
    } finally { setSaving(false); }
  }
  async function unsubscribe() {
    setSaving(true);
    try { await api.unsubscribeEmail(); await refresh(); }
    finally { setSaving(false); }
  }
  async function togglePref(key: "cliff_7d" | "cliff_1d" | "claim_ready") {
    if (!me) return;
    setSaving(true);
    try {
      await api.updateMe({ notif_prefs: { ...me.notif_prefs, [key]: !me.notif_prefs[key] } });
      await refresh();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("settings:title")}</h1>

      {verifiedFlash === "ok" && (
        <div className="rounded-md bg-green-900/40 border border-green-800 p-3 text-green-200 text-sm">
          {t("settings:verified")}
        </div>
      )}
      {verifiedFlash === "error" && (
        <div className="rounded-md bg-red-900/40 border border-red-800 p-3 text-red-200 text-sm">
          {t("settings:verifyError")}
        </div>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 space-y-3">
        <h2 className="font-semibold">{t("settings:wallet.title")}</h2>
        <p className="text-sm">
          {t("settings:wallet.connected")}: <span className="font-mono">{shortAddress(me.address)}</span>
        </p>
        <button
          onClick={() => void signOut()}
          className="text-sm text-neutral-300 hover:text-white underline"
        >
          {t("settings:wallet.disconnect")}
        </button>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 space-y-3">
        <h2 className="font-semibold">{t("settings:email.title")}</h2>
        <p className="text-sm text-neutral-400">{t("settings:email.description")}</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder={t("settings:email.placeholder")}
            className="flex-1 bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2"
          />
          <button
            onClick={() => void subscribe()}
            disabled={saving || !emailInput}
            className="rounded-md bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 disabled:opacity-50 transition"
          >
            {t("settings:email.subscribe")}
          </button>
        </div>
        {me.email && (
          <div className="text-sm text-neutral-400 flex items-center gap-3">
            {t("settings:email.subscribed")}: <span className="font-mono">{me.email}</span>
            {me.email_verified ? (
              <span className="text-green-400">✓ {t("settings:email.verified")}</span>
            ) : (
              <span className="text-yellow-400">{t("settings:email.unverified")}</span>
            )}
            <button onClick={() => void unsubscribe()} className="ml-auto underline text-neutral-300 hover:text-white">
              {t("settings:email.remove")}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 space-y-3">
        <h2 className="font-semibold">{t("settings:prefs.title")}</h2>
        {(["cliff_7d", "cliff_1d", "claim_ready"] as const).map((k) => (
          <label key={k} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={me.notif_prefs[k]}
              onChange={() => void togglePref(k)}
              className="size-4"
              disabled={saving}
            />
            {t(`settings:prefs.${k}`)}
          </label>
        ))}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 space-y-3">
        <h2 className="font-semibold">{t("settings:language.title")}</h2>
        <select
          value={me.language}
          disabled={saving}
          onChange={async (e) => {
            setSaving(true);
            try { await api.updateMe({ language: e.target.value }); await refresh(); }
            finally { setSaving(false); }
          }}
          className="bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2"
        >
          <option value="en">{t("settings:language.en")}</option>
        </select>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add `/settings` route to `frontend/src/App.tsx`**

Replace the contents of the file with:

```tsx
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Vesting from "./pages/Vesting";
import Migrate from "./pages/Migrate";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="vesting" element={<Vesting />} />
        <Route path="migrate" element={<Migrate />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 3: Add Settings link to nav**

Replace the `<nav>` block in `frontend/src/components/Layout.tsx` with:

```tsx
<nav className="flex gap-1">
  <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
    Overview
  </NavLink>
  <NavLink to="/vesting" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
    Vesting
  </NavLink>
  <NavLink to="/migrate" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
    Migrate
  </NavLink>
  <NavLink to="/settings" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
    Settings
  </NavLink>
</nav>
```

- [ ] **Step 4: Build**

```
cd frontend && npm run build
```

Expected: `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Settings.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(frontend): Settings page (SIWE + email + prefs + language)"
```

---

## Task 20: Frontend — Dashboard page

**Files:**
- Create: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Create `frontend/src/pages/Dashboard.tsx`**

```tsx
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
```

- [ ] **Step 2: Add `/dashboard` route to `frontend/src/App.tsx`**

Replace the file contents with:

```tsx
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Vesting from "./pages/Vesting";
import Migrate from "./pages/Migrate";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="vesting" element={<Vesting />} />
        <Route path="migrate" element={<Migrate />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 3: Add Dashboard link in `Layout.tsx` (between Overview and Vesting)**

Replace the `<nav>` block with:

```tsx
<nav className="flex gap-1">
  <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
    Overview
  </NavLink>
  <NavLink to="/dashboard" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
    Dashboard
  </NavLink>
  <NavLink to="/vesting" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
    Vesting
  </NavLink>
  <NavLink to="/migrate" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
    Migrate
  </NavLink>
  <NavLink to="/settings" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
    Settings
  </NavLink>
</nav>
```

- [ ] **Step 4: Build**

```
npm run build
```

Expected: `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(frontend): Dashboard page with 4 KPI cards"
```

---

## Task 21: Polish Vesting page (translation + progress bar)

**Files:**
- Modify: `frontend/src/pages/Vesting.tsx`

- [ ] **Step 1: Replace the strings + add a progress bar to each card**

Open `frontend/src/pages/Vesting.tsx`. Replace the visible strings with `t(…)` calls and add a progress bar inside each schedule card. Specifically:

1. At the top of the file add:
```ts
import { useTranslation } from "react-i18next";
```

2. Inside the component body (before the `if (!isConnected)` early return) add:
```ts
const { t } = useTranslation(["vesting", "common"]);
```

3. Replace the existing `<header>` block with:
```tsx
<header>
  <h1 className="text-2xl font-bold">{t("vesting:title")}</h1>
  <p className="text-sm text-neutral-400">{t("vesting:subtitle")}</p>
</header>
```

4. Replace the empty-state message with `t("vesting:noSchedules")`.

5. Inside the schedule-card grid, add this **above** the `<div className="grid grid-cols-2 …">` block:
```tsx
<div className="mb-4">
  <div className="h-2 w-full bg-neutral-800 rounded">
    <div
      className="h-2 bg-green-500 rounded"
      style={{ width: `${pct.toFixed(1)}%` }}
      aria-label="vest progress"
    />
  </div>
</div>
```

6. Replace the field labels with translations:
```tsx
<div><dt className="text-neutral-400">{t("vesting:fields.total")}</dt><dd>{fmtCZM(s.totalAmount)} CZM</dd></div>
<div><dt className="text-neutral-400">{t("vesting:fields.released")}</dt><dd>{fmtCZM(s.released)} CZM ({pct.toFixed(1)}%)</dd></div>
<div><dt className="text-neutral-400">{t("vesting:fields.releasable")}</dt><dd className="text-green-400 font-semibold">{fmtCZM(s.releasable)} CZM</dd></div>
<div><dt className="text-neutral-400">{t("vesting:fields.start")}</dt><dd>{start.toLocaleString()}</dd></div>
<div><dt className="text-neutral-400">{t("vesting:fields.cliffEnds")}</dt><dd>{cliffEnd.toLocaleString()}</dd></div>
<div><dt className="text-neutral-400">{t("vesting:fields.fullyVested")}</dt><dd>{end.toLocaleString()}</dd></div>
```

7. Replace the button label with:
```tsx
{isPending ? t("vesting:awaitingWallet") : isConfirming ? t("vesting:confirming") : t("vesting:release", { amount: fmtCZM(s.releasable) })}
```

8. Replace the success banner with `{t("vesting:released")}`.

- [ ] **Step 2: Build**

```
npm run build
```

Expected: `✓ built`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Vesting.tsx
git commit -m "feat(frontend): Vesting page i18n + progress bar"
```

---

## Task 22: Frontend — set production API base URL + redeploy

**Files:**
- (no source change — env var configuration only)

- [ ] **Step 1: Capture the deployed Worker URL**

From Task 15 step 2, the Worker URL is e.g. `https://czero-portal-api.<account>.workers.dev`. If a custom domain was set, use that instead.

- [ ] **Step 2: Set `VITE_API_BASE_URL` on Cloudflare Pages**

In Cloudflare Dashboard → Pages → `czero-portal` → Settings → Environment variables, add:
```
VITE_API_BASE_URL = https://czero-portal-api.<account>.workers.dev
```
(Production environment.)

Alternatively from CLI:
```
cd frontend
echo "VITE_API_BASE_URL=https://czero-portal-api.<account>.workers.dev" >> .env
```
Note: env vars are inlined at build time; redeploying with the value present in `.env` is required.

- [ ] **Step 3: Rebuild and redeploy frontend**

```
cd frontend && npm run build && npm run deploy
```

Expected: deployment URL printed; production now points at Worker.

- [ ] **Step 4: Commit (no source change)**

```bash
git commit --allow-empty -m "ops(frontend): wired VITE_API_BASE_URL and redeployed"
```

---

## Task 23: End-to-end manual walkthrough

**Files:**
- Create: `docs/superpowers/runbooks/2026-05-07-mvp-e2e-checklist.md`

- [ ] **Step 1: Create the checklist `docs/superpowers/runbooks/2026-05-07-mvp-e2e-checklist.md`**

```markdown
# MVP E2E walkthrough — Phase 1 testnet

Pre-conditions: backend deployed, frontend deployed with `VITE_API_BASE_URL`, Resend API key live, D1 migrated.

## 1. Wallet connection
- [ ] Open https://czero-portal.pages.dev
- [ ] Click Connect → choose MetaMask → approve
- [ ] Network auto-switches to Base Sepolia
- [ ] Header shows shortened address

## 2. Sign-in with Ethereum
- [ ] Open `/settings`
- [ ] Click "Sign in with Ethereum"
- [ ] Wallet prompts message — sign it
- [ ] Page rerenders showing "Wallet" + "Email notifications" sections

## 3. Email subscription + verification
- [ ] Enter a real inbox email → click Subscribe
- [ ] Verify email arrives within 1 minute (subject: "Verify your C-ZERO portal email")
- [ ] Click the verification link → redirects to `/settings?emailVerified=ok`
- [ ] Settings page shows "✓ Verified"

## 4. Vesting view
- [ ] Onboard alice via `npm run create-schedule -- 0xAlice 1000 0 300 true` (founder script)
- [ ] On `/vesting`, schedule appears with progress bar at 0%
- [ ] Wait 60 seconds → "Releasable now" shows ~200 CZM
- [ ] Click "Release 200 CZM" → wallet prompts → confirm
- [ ] Page rerenders; releasable drops, released increases

## 5. Email notifications via cron
- [ ] Manually trigger cron:
      curl https://czero-portal-api.<account>.workers.dev/__scheduled?cron=0+%2A+%2A+%2A+%2A
- [ ] Verify "claim_ready" email arrives (only if releasable > 0)
- [ ] Trigger again → no duplicate (dedupe works)

## 6. Migrate page (sanity)
- [ ] Visit `/migrate` — page loads without errors
- [ ] Approval / Migrate buttons gated as expected based on v1 balance

## 7. Logout
- [ ] Settings → Disconnect → reload page → Settings shows the SIWE prompt again

## 8. Mobile responsive sanity
- [ ] Resize browser to 375px width — layout reflows; no horizontal scroll
```

- [ ] **Step 2: Run through the checklist; tick boxes as you go**

Execute the checklist literally on the deployed environment. Fix anything that fails before proceeding.

- [ ] **Step 3: Commit the runbook**

```bash
mkdir -p docs/superpowers/runbooks
git add docs/superpowers/runbooks/2026-05-07-mvp-e2e-checklist.md
git commit -m "docs(runbook): MVP E2E checklist"
```

---

## Task 24: Update DEPLOYMENT.md with MVP architecture

**Files:**
- Modify: `DEPLOYMENT.md`

- [ ] **Step 1: Append a new section under "Phase 1 — Pre-sale Infrastructure"**

Add the following block to `DEPLOYMENT.md`, immediately before the "Change log" section:

```markdown
## Phase 1 MVP — Investor Portal backend

| Item | Value |
|---|---|
| Worker | `czero-portal-api` (Cloudflare Worker) |
| Custom domain | `https://czero-portal-api.<account>.workers.dev` (or custom DNS) |
| Database | D1 `czero-portal-db` (id captured during creation) |
| Email provider | Resend (`RESEND_API_KEY` secret) |
| Cron | `0 * * * *` (hourly) — schedule scan + dedupe email |
| Auth | SIWE (EIP-4361) → HttpOnly session cookie (HMAC-SHA256, 7 days) |

### API surface
- `POST /api/auth/nonce` / `POST /api/auth/verify` / `POST /api/auth/logout`
- `GET /api/me` / `PUT /api/me`
- `POST /api/me/email` / `DELETE /api/me/email`
- `GET /api/email/verify?token=…` (public)
- `scheduled` (cron — no HTTP)

### Re-deploy
```
cd backend
npx wrangler deploy
cd ../frontend
npm run build && npm run deploy
```
```

- [ ] **Step 2: Commit**

```bash
git add DEPLOYMENT.md
git commit -m "docs: add Phase 1 MVP backend section to DEPLOYMENT.md"
```

---

## Task 25: Open PR and merge

**Files:**
- (no source change)

- [ ] **Step 1: Push and create PR**

```bash
git push -u origin feat/backend-worker-scaffold
gh pr create --title "feat: Phase 1 MVP — investor portal (backend Worker + frontend Dashboard/Settings/i18n)" \
  --body "Implements docs/superpowers/specs/2026-05-06-phase1-mvp-investor-portal-design.md.

- New backend/ Cloudflare Worker (Hono + D1 + SIWE + Resend + hourly cron)
- Frontend extensions: Settings, Dashboard, i18n (EN), Vesting polish
- 31 backend unit tests, manual E2E checklist
- All targets Base Sepolia testnet"
```

- [ ] **Step 2: Merge once green**

```bash
gh pr merge --merge --delete-branch
```

---

## Self-Review (run inline — do NOT skip)

Walk through the spec one more time and verify:

| Spec section | Implementation task(s) |
|---|---|
| §1 Goal | Tasks 1–25 collectively |
| §2 Constraints (testnet, manual KYC) | Task 2 (wrangler.toml ALLOWED_ORIGIN, RPC_URL) |
| §3 Architecture diagram | Tasks 1–14 (backend) + 16–22 (frontend) |
| §4.1 Frontend pages | Tasks 16, 17, 19, 20, 21 |
| §4.2 Backend Worker | Tasks 1–14 |
| §4.3 D1 schema | Task 3 |
| §4.4 Email templates | Task 10 (renderers), Task 14 (use sites) |
| §5 SIWE auth | Tasks 6, 7, 8 |
| §6 i18n | Task 16 |
| §7 Error handling | Tasks 7 (401), 8 (cookie invalid), 10 (Resend fail), 14 (RPC fail), 11 (revoked schedule), 11 (clear email) |
| §8 Testing strategy | Tasks 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 (vitest) + Task 23 (E2E) |
| §9 Deployment plan | Task 3 (D1), 15 (secrets + deploy), 22 (frontend), 23 (smoke test) |
| §11 Build order | Tasks ordered approximately A → G of the spec |
| §12 Out of scope | Verified — no Staking/Buy/veCZM pages, no admin UI, no operator/mining/etc. portals |

Placeholder scan: searched for "TBD", "TODO", "fill in", "implement later", "appropriate" — none present.
Type consistency: `MeResponse` shape in `frontend/src/lib/api.ts` matches `meRoutes.get` return shape in `backend/src/me.ts` (address, email, email_verified boolean, notif_prefs object, language). `NotificationKind` is the same string union across `backend/src/types.ts` and `backend/src/email.ts` callers.
Scope: every spec requirement has at least one task. Frontend test omission is consistent with §8.

import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { isAddress } from "viem";
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

  // Parse + extract address/nonce from the message before signature verification
  const { parseSiweMessage, verifySiweMessage } = await import("viem/siwe");
  let parsed: ReturnType<typeof parseSiweMessage>;
  try {
    parsed = parseSiweMessage(message);
  } catch {
    return c.json({ error: "INVALID_MESSAGE" }, 400);
  }
  if (!parsed.address || !parsed.nonce) {
    return c.json({ error: "INVALID_MESSAGE" }, 400);
  }
  const claimedAddress = parsed.address.toLowerCase();
  const expectedDomain = new URL(c.env.APP_BASE_URL).host;
  const expectedChainId = parseInt(c.env.CHAIN_ID, 10);

  // Consume nonce (atomic). Verifies the nonce was issued AND for this address.
  const now = Math.floor(Date.now() / 1000);
  const nonceRow = await consumeNonce(c.env.DB, parsed.nonce, now);
  if (!nonceRow || nonceRow.address !== claimedAddress) {
    return c.json({ error: "INVALID_NONCE" }, 401);
  }

  // Full SIWE validation: domain, uri, chainId, signature, time bounds.
  // Phase 1 only supports EOA wallets — pass a stub client and mode:"eoa" so
  // verifySiweMessage uses pure ECDSA recovery (no RPC required).
  const ok = await verifySiweMessage({ chain: null } as any, {
    address: parsed.address,
    message,
    signature: signature as `0x${string}`,
    domain: expectedDomain,
    nonce: parsed.nonce,
    mode: "eoa",
  } as any);
  if (!ok) return c.json({ error: "INVALID_SIGNATURE" }, 401);

  // Optional: enforce chainId from parsed message matches expected
  if (parsed.chainId !== expectedChainId) {
    return c.json({ error: "INVALID_CHAIN" }, 401);
  }

  await upsertUser(c.env.DB, claimedAddress, {}, now);

  const exp = now + SESSION_TTL_SEC;
  const cookie = await signSession(c.env.SIWE_SECRET, claimedAddress, exp);
  setCookie(c, "siwe_session", cookie, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
  return c.json({ address: claimedAddress });
});

authRoutes.post("/logout", async (c) => {
  deleteCookie(c, "siwe_session", { path: "/", secure: true, sameSite: "None" });
  return c.json({ ok: true });
});

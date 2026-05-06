export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  RPC_URL: string;
  CHAIN_ID: string;
  CZM_VESTING_ADDRESS: string;
  APP_BASE_URL: string;
  API_BASE_URL: string;
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

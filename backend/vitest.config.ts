import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

const initSql = readFileSync(resolve(__dirname, "migrations/0001_init.sql"), "utf-8");
const TEST_MIGRATIONS = [{ name: "0001_init", queries: initSql.split(/;\s*\n/).filter(Boolean) }];

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        isolatedStorage: true,
        miniflare: {
          d1Databases: ["DB"],
          d1Persist: false,
          bindings: {
            ALLOWED_ORIGIN: "https://czero-portal.pages.dev",
            RPC_URL: "https://sepolia.base.org",
            CHAIN_ID: "84532",
            CZM_VESTING_ADDRESS: "0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79",
            APP_BASE_URL: "https://czero-portal.pages.dev",
            API_BASE_URL: "https://api.example",
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

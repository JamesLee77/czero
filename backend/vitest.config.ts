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

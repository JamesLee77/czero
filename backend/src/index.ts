import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { authRoutes } from "./auth";
import { meRoutes } from "./me";

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

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, _env: Env, _ctx: ExecutionContext) {
    // populated in Task 14
  },
} satisfies ExportedHandler<Env>;

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

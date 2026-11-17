import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { openDb } from "./db";
import { api } from "./routes";
import { refreshFeeds } from "./feeds";
import type { AppEnv, Env } from "./env";

const app = new Hono<AppEnv>();

// ─── Host routing ──────────────────────────────────
// www.havonashield.tech → havonashield.tech; apex "/" serves the marketing page.
app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  const apex = c.env.MARKETING_HOST;
  if (apex && url.hostname === `www.${apex}`) {
    url.hostname = apex;
    return c.redirect(url.toString(), 301);
  }
  if (apex && url.hostname === apex && !url.pathname.startsWith("/api/")) {
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return c.env.ASSETS.fetch(new Request(new URL("/landing", url), c.req.raw));
    }
  }
  await next();
});

// ─── API ───────────────────────────────────────────
app.use("/api/*", secureHeaders({ crossOriginResourcePolicy: "same-origin" }));
app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  const { db, close } = await openDb(c.env.HYPERDRIVE.connectionString);
  c.set("db", db);
  try {
    await next();
  } finally {
    c.executionCtx.waitUntil(close());
  }
});
app.route("/api", api);
app.all("/api/*", (c) => c.json({ message: "Not found" }, 404));

// Everything else: static assets / SPA (handled by the ASSETS binding).
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  console.error(`[error] ${c.req.method} ${new URL(c.req.url).pathname}:`, err);
  return c.json({ message: "Internal server error" }, 500);
});

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const { db, close } = await openDb(env.HYPERDRIVE.connectionString);
        try {
          await refreshFeeds(db, env);
        } finally {
          await close();
        }
      })(),
    );
  },
} satisfies ExportedHandler<Env>;

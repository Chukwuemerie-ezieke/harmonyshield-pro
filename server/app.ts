import express, { type Express, type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { randomUUID } from "crypto";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes";
import { apiLimiter } from "./rate-limit";
import { storage } from "./storage";
import { reportError } from "./observability";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Emit one structured JSON log line per request. Response bodies are never
 * logged (they can contain JWTs / passwords for /api/auth/*); only
 * non-sensitive request metadata and the status/duration are recorded.
 */
function logRequest(entry: {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestId: string;
}) {
  console.log(
    JSON.stringify({
      level: "info",
      type: "request",
      timestamp: new Date().toISOString(),
      ...entry,
    }),
  );
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Build the fully-configured Express app (security headers, CORS, rate
 * limiting, API routes and the JSON error handler) WITHOUT calling listen().
 *
 * Both the production bootstrap in index.ts and the integration tests build the
 * app through this function so the two run the exact same middleware stack.
 * The returned httpServer is created from the app but is NOT listening; callers
 * that need to serve traffic (index.ts) call httpServer.listen() themselves,
 * while supertest drives the Express app directly.
 */
export async function createApp(): Promise<{ app: Express; httpServer: Server }> {
  const app = express();
  const httpServer = createServer(app);

  const isProduction = process.env.NODE_ENV === "production";

  // Trust the first proxy hop so req.ip and rate limiting work correctly when
  // running behind a load balancer / reverse proxy (common on hosting
  // platforms).
  app.set("trust proxy", 1);

  // Security headers. Disable the default CSP outside production because it
  // blocks the Vite dev client (inline scripts, HMR websocket, eval). In
  // production the SPA is served from the same origin, so helmet's defaults are
  // safe; we keep crossOriginEmbedderPolicy off to avoid breaking asset
  // loading.
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS. By default the API is same-origin only (no cross-origin headers). Set
  // ALLOWED_ORIGINS to a comma-separated list of origins to opt into CORS.
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowedOrigins.length > 0) {
    app.use(
      cors({
        origin: allowedOrigins,
        credentials: true,
      }),
    );
  }

  // Global, loose rate limiter for the whole API surface. Stricter per-route
  // limits (auth) are applied in routes.ts.
  app.use("/api", apiLimiter);

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

  // Attach a request id and emit a structured JSON log line on finish. We log
  // only safe request metadata and the status/duration - NEVER the response
  // body, which for /api/auth/* contains JWTs and must not be logged.
  app.use((req, res, next) => {
    const start = Date.now();
    const requestId = randomUUID();
    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    res.on("finish", () => {
      if (req.path.startsWith("/api")) {
        logRequest({
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - start,
          requestId,
        });
      }
    });

    next();
  });

  // ─── Health check (public: outside auth and the /api rate limiter) ───
  // /healthz is intentionally NOT under /api so the global rate limiter never
  // throttles orchestrator / load-balancer probes. It performs a trivial
  // awaited storage read so the status reflects real DB readiness. No secrets
  // are ever returned.
  app.get("/healthz", async (_req, res) => {
    const payload: {
      status: "ok" | "degraded";
      uptime: number;
      timestamp: string;
      db: "up" | "down";
    } = {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      db: "up",
    };

    try {
      await storage.getSchools();
    } catch {
      payload.status = "degraded";
      payload.db = "down";
    }

    return res.status(payload.status === "ok" ? 200 : 503).json(payload);
  });

  await registerRoutes(httpServer, app);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    // Optional error-tracking hook (no-op unless SENTRY_DSN / ERROR_WEBHOOK is
    // configured). Fire-and-forget so a failing sink never blocks the response.
    void reportError(err, {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
    });

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  return { app, httpServer };
}

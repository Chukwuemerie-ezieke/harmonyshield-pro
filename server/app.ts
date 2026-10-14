import express, { type Express, type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes";
import { apiLimiter } from "./rate-limit";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
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

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        log(logLine);
      }
    });

    next();
  });

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  return { app, httpServer };
}

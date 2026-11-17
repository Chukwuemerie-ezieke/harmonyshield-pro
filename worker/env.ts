import type { Database } from "./db";

export interface Env {
  ASSETS: Fetcher;
  HYPERDRIVE: Hyperdrive;
  /** Rate limiting bindings (optional so local dev without them still works). */
  LOGIN_LIMITER?: RateLimit;
  API_LIMITER?: RateLimit;

  // Secrets (wrangler secret put …)
  JWT_SECRET: string;
  OTX_API_KEY?: string;
  ABUSEIPDB_API_KEY?: string;

  // Vars (wrangler.jsonc)
  ENVIRONMENT: string;
  /** Apex marketing domain, e.g. havonashield.tech */
  MARKETING_HOST: string;
  /** Comma-separated hosts where the one-click read-only demo is allowed. */
  DEMO_HOSTS: string;
  APP_URL: string;
  DEMO_URL: string;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
  schoolId: number;
  isDemo: boolean;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: Database;
    user: AuthUser;
  };
};

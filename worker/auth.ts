import { sign, verify } from "hono/jwt";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { users, schools, type Role } from "@shared/schema";
import type { AppEnv, Env } from "./env";

const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12h
const DEMO_TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2h

function secret(env: Env): string {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    // Fail closed — never sign tokens with a weak or default secret.
    throw new HTTPException(500, { message: "Server misconfigured" });
  }
  return env.JWT_SECRET;
}

export async function issueToken(env: Env, userId: number, tokenVersion: number, demo = false): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    { sub: String(userId), v: tokenVersion, iat: now, exp: now + (demo ? DEMO_TOKEN_TTL_SECONDS : TOKEN_TTL_SECONDS) },
    secret(env),
    "HS256",
  );
}

/** Verifies the bearer token and re-loads the user so role/deactivation changes apply immediately. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) throw new HTTPException(401, { message: "Authentication required" });

  let payload: Record<string, unknown>;
  try {
    payload = await verify(header.slice(7), secret(c.env), "HS256");
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) throw new HTTPException(401, { message: "Invalid token" });

  const [row] = await c.var.db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      schoolId: users.schoolId,
      isActive: users.isActive,
      tokenVersion: users.tokenVersion,
      isDemo: schools.isDemo,
    })
    .from(users)
    .innerJoin(schools, eq(users.schoolId, schools.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || !row.isActive || row.tokenVersion !== payload.v) {
    throw new HTTPException(401, { message: "Session expired. Please sign in again." });
  }

  c.set("user", {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    schoolId: row.schoolId,
    isDemo: row.isDemo,
  });
  await next();
});

export function requireRole(...roles: Role[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.var.user.role as Role)) {
      throw new HTTPException(403, { message: "You do not have permission to do this" });
    }
    await next();
  });
}

/** The demo school is read-only for everyone (except quiz attempts, which are not persisted). */
export const demoReadOnly = createMiddleware<AppEnv>(async (c, next) => {
  const method = c.req.method;
  if (c.var.user.isDemo && method !== "GET" && method !== "HEAD" && !/\/api\/training\/courses\/\d+\/submit$/.test(c.req.path)) {
    throw new HTTPException(403, { message: "The demo is read-only. Sign up to use HavonaShield with your school." });
  }
  await next();
});

export function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header("cf-connecting-ip") || "unknown";
}

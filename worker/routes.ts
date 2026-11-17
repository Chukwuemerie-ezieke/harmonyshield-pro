import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import {
  schools, users, complianceItems, threats, incidents, incidentActions, trainingCourses,
  trainingProgress, newsArticles, auditLog,
  loginSchema, changePasswordSchema, createUserSchema, updateUserSchema, updateComplianceSchema,
  createIncidentSchema, updateIncidentSchema, createIncidentActionSchema, updateIncidentActionSchema,
  trainingProgressSchema, quizSubmissionSchema, updateSettingsSchema, ipSchema,
  type User, type PublicUser,
} from "@shared/schema";
import { hashPassword, verifyPassword } from "@shared/password";
import { issueToken, requireAuth, requireRole, demoReadOnly, clientIp } from "./auth";
import { readFeed, checkIPReputation, RSS_FEEDS, type LiveNewsItem, type OTXThreat } from "./feeds";
import type { AppEnv } from "./env";

type C = Context<AppEnv>;

const now = () => new Date().toISOString();

async function body<T extends z.ZodTypeAny>(c: C, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new HTTPException(400, { message: `${issue.path.join(".") || "body"}: ${issue.message}` });
  }
  return parsed.data;
}

function idParam(c: C, name = "id"): number {
  const n = Number(c.req.param(name));
  if (!Number.isInteger(n) || n <= 0) throw new HTTPException(400, { message: "Invalid id" });
  return n;
}

function publicUser(u: User): PublicUser {
  const { password: _p, tokenVersion: _v, ...rest } = u;
  return rest;
}

async function audit(c: C, action: string, entityType: string, entityId: number | null, details: string) {
  const u = c.var.user;
  await c.var.db.insert(auditLog).values({
    schoolId: u.schoolId, userId: u.id, action, entityType, entityId, details, timestamp: now(),
  });
}

async function rateLimit(limiter: RateLimit | undefined, key: string) {
  if (!limiter) return;
  const { success } = await limiter.limit({ key });
  if (!success) throw new HTTPException(429, { message: "Too many requests. Please wait a minute and try again." });
}

function isDemoHost(c: C): boolean {
  const host = new URL(c.req.url).hostname;
  const allowed = (c.env.DEMO_HOSTS || "").split(",").map((h) => h.trim()).filter(Boolean);
  return allowed.includes(host);
}

// Quiz answers never leave the server.
function stripAnswers(quizJson: string | null): string | null {
  if (!quizJson) return quizJson;
  try {
    const quiz = JSON.parse(quizJson) as Array<{ question: string; options: string[] }>;
    return JSON.stringify(quiz.map(({ question, options }) => ({ question, options })));
  } catch {
    return null;
  }
}

export const api = new Hono<AppEnv>();

// ═══════════════════════════════════════════════════
// PUBLIC
// ═══════════════════════════════════════════════════

api.get("/health", async (c) => {
  await c.var.db.execute(sql`select 1`);
  return c.json({ status: "ok" });
});

api.get("/config", (c) =>
  c.json({ demoAvailable: isDemoHost(c), appUrl: c.env.APP_URL, demoUrl: c.env.DEMO_URL }),
);

api.post("/auth/login", async (c) => {
  const { email, password } = await body(c, loginSchema);
  await rateLimit(c.env.LOGIN_LIMITER, `${clientIp(c)}:${email}`);

  const [user] = await c.var.db.select().from(users).where(eq(users.email, email)).limit(1);
  // Always run a hash comparison so response timing does not reveal whether the email exists.
  const valid = await verifyPassword(password, user?.password ?? "pbkdf2$1$AAAA$AAAA");
  if (!user || !valid || !user.isActive) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }
  const [school] = await c.var.db.select({ isDemo: schools.isDemo }).from(schools).where(eq(schools.id, user.schoolId));
  if (school?.isDemo) throw new HTTPException(401, { message: "Invalid email or password" });

  await c.var.db.update(users).set({ lastLoginAt: now() }).where(eq(users.id, user.id));
  await c.var.db.insert(auditLog).values({
    schoolId: user.schoolId, userId: user.id, action: "user_login", entityType: "user", entityId: user.id,
    details: `Login from ${clientIp(c)}`, timestamp: now(),
  });

  const token = await issueToken(c.env, user.id, user.tokenVersion);
  return c.json({ token, user: { ...publicUser(user), isDemo: false } });
});

/** One-click read-only demo, only on the demo host. */
api.post("/auth/demo", async (c) => {
  if (!isDemoHost(c)) throw new HTTPException(404, { message: "Not found" });
  await rateLimit(c.env.LOGIN_LIMITER, `demo:${clientIp(c)}`);
  const [row] = await c.var.db
    .select({ user: users })
    .from(users)
    .innerJoin(schools, eq(users.schoolId, schools.id))
    .where(and(eq(schools.isDemo, true), eq(users.role, "admin"), eq(users.isActive, true)))
    .orderBy(asc(users.id))
    .limit(1);
  if (!row) throw new HTTPException(503, { message: "Demo is not available right now" });
  const token = await issueToken(c.env, row.user.id, row.user.tokenVersion, true);
  return c.json({ token, user: { ...publicUser(row.user), isDemo: true } });
});

// ═══════════════════════════════════════════════════
// AUTHENTICATED
// ═══════════════════════════════════════════════════
const authed = new Hono<AppEnv>();
authed.use("*", requireAuth, demoReadOnly, async (c, next) => {
  await rateLimit(c.env.API_LIMITER, `user:${c.var.user.id}`);
  await next();
});

authed.get("/auth/me", async (c) => {
  const [u] = await c.var.db.select().from(users).where(eq(users.id, c.var.user.id));
  return c.json({ ...publicUser(u), isDemo: c.var.user.isDemo });
});

authed.post("/auth/change-password", async (c) => {
  const { currentPassword, newPassword } = await body(c, changePasswordSchema);
  await rateLimit(c.env.LOGIN_LIMITER, `pw:${c.var.user.id}`);
  const [u] = await c.var.db.select().from(users).where(eq(users.id, c.var.user.id));
  if (!(await verifyPassword(currentPassword, u.password))) {
    throw new HTTPException(400, { message: "Current password is incorrect" });
  }
  const [updated] = await c.var.db
    .update(users)
    .set({ password: await hashPassword(newPassword), tokenVersion: u.tokenVersion + 1 })
    .where(eq(users.id, u.id))
    .returning();
  await audit(c, "password_changed", "user", u.id, "Changed own password");
  // Old tokens are now invalid; hand back a fresh one.
  return c.json({ token: await issueToken(c.env, updated.id, updated.tokenVersion) });
});

// ─── Dashboard ─────────────────────────────────────
authed.get("/dashboard", async (c) => {
  const { db, user } = c.var;
  const [items, schoolIncidents, courseCount, completed, threatList] = await Promise.all([
    db.select().from(complianceItems).where(eq(complianceItems.schoolId, user.schoolId)),
    db.select().from(incidents).where(eq(incidents.schoolId, user.schoolId)).orderBy(desc(incidents.createdAt)),
    db.select({ n: sql<number>`count(*)::int` }).from(trainingCourses),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(trainingProgress)
      .where(and(eq(trainingProgress.userId, user.id), eq(trainingProgress.status, "completed"))),
    threatsFor(c),
  ]);
  const totalCourses = courseCount[0]?.n ?? 0;
  const completedCourses = completed[0]?.n ?? 0;
  return c.json({
    complianceScore: complianceScore(items),
    activeThreats: threatList.filter((t) => t.severity === "critical" || t.severity === "high").length,
    totalThreats: threatList.length,
    activeIncidents: schoolIncidents.filter((i) => i.status !== "resolved" && i.status !== "closed").length,
    totalIncidents: schoolIncidents.length,
    trainingCompletion: totalCourses ? Math.round((completedCourses / totalCourses) * 100) : 0,
    totalCourses,
    completedCourses,
    recentIncidents: schoolIncidents.slice(0, 5),
    threatStats: threatStats(threatList),
  });
});

function complianceScore(items: { status: string; weight: number | null }[]): number {
  if (items.length === 0) return 0;
  const w = (i: { weight: number | null }) => i.weight || 5;
  const total = items.reduce((s, i) => s + w(i), 0);
  const done = items.reduce((s, i) => s + (i.status === "compliant" ? w(i) : i.status === "partial" ? w(i) * 0.5 : 0), 0);
  return Math.round((done / total) * 100);
}

// ─── Compliance ────────────────────────────────────
authed.get("/compliance", async (c) => {
  const items = await c.var.db
    .select()
    .from(complianceItems)
    .where(eq(complianceItems.schoolId, c.var.user.schoolId))
    .orderBy(asc(complianceItems.id));
  return c.json({ items, score: complianceScore(items) });
});

authed.put("/compliance/:id", requireRole("admin", "dpo"), async (c) => {
  const id = idParam(c);
  const data = await body(c, updateComplianceSchema);
  const [updated] = await c.var.db
    .update(complianceItems)
    .set({ ...data, updatedAt: now() })
    .where(and(eq(complianceItems.id, id), eq(complianceItems.schoolId, c.var.user.schoolId)))
    .returning();
  if (!updated) throw new HTTPException(404, { message: "Item not found" });
  await audit(c, "compliance_update", "compliance", id, `Updated "${updated.title}" to ${updated.status}`);
  return c.json(updated);
});

// ─── Threats ───────────────────────────────────────
type ThreatView = { severity: string; isLive: boolean };

async function threatsFor(c: C): Promise<ThreatView[]> {
  const live = (await readFeed<OTXThreat[]>(c.var.db, "otx"))?.data ?? [];
  if (!c.var.user.isDemo) return live;
  const samples = await c.var.db.select().from(threats).orderBy(desc(threats.publishedAt));
  return [...live, ...samples.map((t) => ({ ...t, isLive: false, isSample: true }))];
}

function threatStats(list: { severity: string }[]) {
  const count = (s: string) => list.filter((t) => t.severity === s).length;
  return { total: list.length, critical: count("critical"), high: count("high"), medium: count("medium"), low: count("low") };
}

authed.get("/threats", async (c) => c.json(await threatsFor(c)));
authed.get("/threats/stats", async (c) => c.json(threatStats(await threatsFor(c))));

authed.get("/ip-check/:ip", async (c) => {
  const parsed = ipSchema.safeParse(c.req.param("ip"));
  if (!parsed.success) throw new HTTPException(400, { message: "Enter a valid IPv4 or IPv6 address" });
  if (!c.env.ABUSEIPDB_API_KEY) throw new HTTPException(503, { message: "IP reputation checks are not configured" });
  const result = await checkIPReputation(c.env, parsed.data);
  if (!result) throw new HTTPException(502, { message: "IP reputation service unavailable" });
  return c.json(result);
});

// ─── Incidents ─────────────────────────────────────
async function loadIncident(c: C, id: number) {
  const [incident] = await c.var.db
    .select()
    .from(incidents)
    .where(and(eq(incidents.id, id), eq(incidents.schoolId, c.var.user.schoolId)));
  if (!incident) throw new HTTPException(404, { message: "Incident not found" });
  return incident;
}

authed.get("/incidents", async (c) =>
  c.json(
    await c.var.db
      .select()
      .from(incidents)
      .where(eq(incidents.schoolId, c.var.user.schoolId))
      .orderBy(desc(incidents.createdAt)),
  ),
);

authed.get("/incidents/:id", async (c) => {
  const incident = await loadIncident(c, idParam(c));
  const actions = await c.var.db
    .select()
    .from(incidentActions)
    .where(eq(incidentActions.incidentId, incident.id))
    .orderBy(desc(incidentActions.createdAt));
  return c.json({ ...incident, actions });
});

authed.post("/incidents", async (c) => {
  const data = await body(c, createIncidentSchema);
  const [incident] = await c.var.db
    .insert(incidents)
    .values({
      ...data,
      schoolId: c.var.user.schoolId,
      reportedBy: c.var.user.name,
      status: "open",
      step: 1,
      createdAt: now(),
    })
    .returning();
  await audit(c, "incident_created", "incident", incident.id, `New ${incident.type} incident reported`);
  return c.json(incident, 201);
});

authed.put("/incidents/:id", requireRole("admin", "dpo"), async (c) => {
  const id = idParam(c);
  const data = await body(c, updateIncidentSchema);
  const existing = await loadIncident(c, id);
  const resolvedAt =
    data.status && ["resolved", "closed"].includes(data.status) ? existing.resolvedAt ?? now() : existing.resolvedAt;
  const [updated] = await c.var.db
    .update(incidents)
    .set({ ...data, resolvedAt })
    .where(and(eq(incidents.id, id), eq(incidents.schoolId, c.var.user.schoolId)))
    .returning();
  await audit(c, "incident_updated", "incident", id, `Updated incident status to ${updated.status}`);
  return c.json(updated);
});

authed.post("/incidents/:id/actions", requireRole("admin", "dpo"), async (c) => {
  const incident = await loadIncident(c, idParam(c));
  const data = await body(c, createIncidentActionSchema);
  const [action] = await c.var.db
    .insert(incidentActions)
    .values({ ...data, incidentId: incident.id, performedBy: c.var.user.name, createdAt: now() })
    .returning();
  await audit(c, "incident_action_added", "incident", incident.id, `Action: ${action.action}`);
  return c.json(action, 201);
});

authed.put("/incident-actions/:id", requireRole("admin", "dpo"), async (c) => {
  const id = idParam(c);
  const data = await body(c, updateIncidentActionSchema);
  // Only actions belonging to an incident in the caller's school.
  const owned = c.var.db
    .select({ id: incidents.id })
    .from(incidents)
    .where(eq(incidents.schoolId, c.var.user.schoolId));
  const [updated] = await c.var.db
    .update(incidentActions)
    .set(data)
    .where(and(eq(incidentActions.id, id), inArray(incidentActions.incidentId, owned)))
    .returning();
  if (!updated) throw new HTTPException(404, { message: "Action not found" });
  return c.json(updated);
});

// ─── Training ──────────────────────────────────────
authed.get("/training/courses", async (c) => {
  const list = await c.var.db.select().from(trainingCourses).orderBy(asc(trainingCourses.id));
  return c.json(list.map((course) => ({ ...course, quizJson: stripAnswers(course.quizJson) })));
});

authed.get("/training/courses/:id", async (c) => {
  const [course] = await c.var.db.select().from(trainingCourses).where(eq(trainingCourses.id, idParam(c)));
  if (!course) throw new HTTPException(404, { message: "Course not found" });
  return c.json({ ...course, quizJson: stripAnswers(course.quizJson) });
});

authed.get("/training/progress", async (c) =>
  c.json(await c.var.db.select().from(trainingProgress).where(eq(trainingProgress.userId, c.var.user.id))),
);

authed.post("/training/progress", async (c) => {
  const { courseId, status } = await body(c, trainingProgressSchema);
  const [course] = await c.var.db.select({ id: trainingCourses.id }).from(trainingCourses).where(eq(trainingCourses.id, courseId));
  if (!course) throw new HTTPException(404, { message: "Course not found" });
  // Starting a course never downgrades a completed one.
  const [row] = await c.var.db
    .insert(trainingProgress)
    .values({ userId: c.var.user.id, courseId, status, startedAt: now() })
    .onConflictDoNothing({ target: [trainingProgress.userId, trainingProgress.courseId] })
    .returning();
  if (row) return c.json(row);
  const [existing] = await c.var.db
    .select()
    .from(trainingProgress)
    .where(and(eq(trainingProgress.userId, c.var.user.id), eq(trainingProgress.courseId, courseId)));
  return c.json(existing);
});

/** Server-side grading — the client never sees the answer key until it submits. */
authed.post("/training/courses/:id/submit", async (c) => {
  const courseId = idParam(c);
  const { answers } = await body(c, quizSubmissionSchema);
  const [course] = await c.var.db.select().from(trainingCourses).where(eq(trainingCourses.id, courseId));
  if (!course?.quizJson) throw new HTTPException(404, { message: "Course not found" });

  const quiz = JSON.parse(course.quizJson) as Array<{ correct: number }>;
  const correctCount = quiz.filter((q, i) => answers[i] === q.correct).length;
  const score = Math.round((correctCount / quiz.length) * 100);
  const passed = score >= (course.passMark ?? 70);
  const result = { score, passed, correctAnswers: quiz.map((q) => q.correct) };

  if (c.var.user.isDemo) return c.json(result); // demo: grade only, don't persist

  const { db, user } = c.var;
  const [existing] = await db
    .select()
    .from(trainingProgress)
    .where(and(eq(trainingProgress.userId, user.id), eq(trainingProgress.courseId, courseId)));
  const alreadyCompleted = existing?.status === "completed";
  const values = {
    status: alreadyCompleted || passed ? "completed" : "in_progress",
    score: Math.max(score, existing?.score ?? 0),
    completedAt: alreadyCompleted ? existing!.completedAt : passed ? now() : null,
  };
  if (existing) await db.update(trainingProgress).set(values).where(eq(trainingProgress.id, existing.id));
  else await db.insert(trainingProgress).values({ userId: user.id, courseId, startedAt: now(), ...values });

  if (passed && !alreadyCompleted) {
    await audit(c, "training_completed", "training", courseId, `Completed "${course.title}" with score ${score}%`);
  }
  return c.json(result);
});

// ─── News ──────────────────────────────────────────
authed.get("/news", async (c) => {
  const live = ((await readFeed<LiveNewsItem[]>(c.var.db, "news"))?.data ?? []).slice(0, 10);
  if (!c.var.user.isDemo) return c.json(live);
  const samples = await c.var.db.select().from(newsArticles).orderBy(desc(newsArticles.publishedAt));
  return c.json([...live, ...samples.map((n) => ({ ...n, isLive: false, isSample: true }))]);
});

// ─── Users / team management ───────────────────────
authed.get("/users", requireRole("admin", "dpo"), async (c) => {
  const list = await c.var.db
    .select()
    .from(users)
    .where(eq(users.schoolId, c.var.user.schoolId))
    .orderBy(asc(users.name));
  return c.json(list.map(publicUser));
});

authed.post("/users", requireRole("admin"), async (c) => {
  const data = await body(c, createUserSchema);
  const [exists] = await c.var.db.select({ id: users.id }).from(users).where(eq(users.email, data.email));
  if (exists) throw new HTTPException(409, { message: "A user with this email already exists" });
  const [created] = await c.var.db
    .insert(users)
    .values({
      ...data,
      password: await hashPassword(data.password),
      schoolId: c.var.user.schoolId,
      createdAt: now(),
    })
    .returning();
  await audit(c, "user_created", "user", created.id, `Added ${created.email} as ${created.role}`);
  return c.json(publicUser(created), 201);
});

authed.patch("/users/:id", requireRole("admin"), async (c) => {
  const id = idParam(c);
  const data = await body(c, updateUserSchema);
  if (id === c.var.user.id && (data.isActive === false || (data.role && data.role !== "admin"))) {
    throw new HTTPException(400, { message: "You cannot deactivate or demote your own account" });
  }
  const set: Partial<User> = { ...data };
  if (data.isActive === false || data.role) set.tokenVersion = sql`${users.tokenVersion} + 1` as unknown as number;
  const [updated] = await c.var.db
    .update(users)
    .set(set)
    .where(and(eq(users.id, id), eq(users.schoolId, c.var.user.schoolId)))
    .returning();
  if (!updated) throw new HTTPException(404, { message: "User not found" });
  await audit(c, "user_updated", "user", id, `Updated ${updated.email}: ${JSON.stringify(data)}`);
  return c.json(publicUser(updated));
});

// ─── Audit ─────────────────────────────────────────
authed.get("/audit", requireRole("admin", "dpo"), async (c) =>
  c.json(
    await c.var.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.schoolId, c.var.user.schoolId))
      .orderBy(desc(auditLog.timestamp))
      .limit(500),
  ),
);

// ─── Feed status ───────────────────────────────────
authed.get("/feeds/status", async (c) => {
  const [news, otx] = await Promise.all([readFeed(c.var.db, "news"), readFeed(c.var.db, "otx")]);
  return c.json({
    rssFeeds: { status: news ? "active" : "inactive", lastUpdate: news?.updatedAt ?? null, sources: RSS_FEEDS.map((f) => f.name) },
    otxThreats: { status: otx ? "active" : "inactive", lastUpdate: otx?.updatedAt ?? null, hasApiKey: !!c.env.OTX_API_KEY },
    abuseIPDB: { hasApiKey: !!c.env.ABUSEIPDB_API_KEY },
    cacheTTL: "15 minutes",
  });
});

// ─── Settings (school profile) ─────────────────────
authed.get("/settings", async (c) => {
  const [school] = await c.var.db.select().from(schools).where(eq(schools.id, c.var.user.schoolId));
  if (!school) throw new HTTPException(404, { message: "School not found" });
  return c.json(school);
});

authed.put("/settings", requireRole("admin"), async (c) => {
  const data = await body(c, updateSettingsSchema);
  const [updated] = await c.var.db
    .update(schools)
    .set(data)
    .where(and(eq(schools.id, c.var.user.schoolId), ne(schools.isDemo, true)))
    .returning();
  if (!updated) throw new HTTPException(404, { message: "School not found" });
  await audit(c, "settings_update", "school", updated.id, "Updated school settings");
  return c.json(updated);
});

api.route("/", authed);

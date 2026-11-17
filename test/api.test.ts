/**
 * End-to-end API tests. Run against a live `wrangler dev` with a seeded database:
 *   npm run db:migrate && npm run db:seed && npm run db:seed-demo
 *   TEST_ADMIN_EMAIL=… TEST_ADMIN_PASSWORD=… BASE_URL=http://127.0.0.1:8787 npm test
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8787";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;

async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, headers: res.headers };
}

async function login(email: string, password: string): Promise<string> {
  const r = await call("POST", "/api/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, `login ${email}: ${JSON.stringify(r.json)}`);
  return r.json.token;
}

let admin: string;
let demo: string;
const suffix = Date.now();
const teacherEmail = `teacher${suffix}@test.ng`;
const teacherPassword = "TeacherPass123!";
let teacherId: number;

before(async () => {
  assert.ok(ADMIN_EMAIL && ADMIN_PASSWORD, "TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set");
  admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const d = await call("POST", "/api/auth/demo");
  assert.equal(d.status, 200, "demo login should work on a demo host");
  demo = d.json.token;
});

test("health and security headers", async () => {
  const r = await call("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("rejects bad credentials, unknown users and missing tokens", async () => {
  assert.equal((await call("POST", "/api/auth/login", { body: { email: ADMIN_EMAIL, password: "wrong-password" } })).status, 401);
  assert.equal((await call("POST", "/api/auth/login", { body: { email: "nobody@x.ng", password: "whatever123" } })).status, 401);
  assert.equal((await call("POST", "/api/auth/login", { body: { email: "not-an-email" } })).status, 400);
  assert.equal((await call("GET", "/api/dashboard")).status, 401);
  assert.equal((await call("GET", "/api/dashboard", { token: "garbage" })).status, 401);
});

test("public self-registration is gone", async () => {
  const r = await call("POST", "/api/auth/register", { body: { name: "x", email: "x@x.ng", password: "x", role: "admin", schoolId: 1 } });
  assert.notEqual(r.status, 200);
});

test("password hashes and token versions are never returned", async () => {
  const me = await call("GET", "/api/auth/me", { token: admin });
  assert.equal(me.status, 200);
  assert.equal(me.json.password, undefined);
  assert.equal(me.json.tokenVersion, undefined);
  const list = await call("GET", "/api/users", { token: admin });
  assert.ok(list.json.every((u: any) => u.password === undefined));
});

test("admin can add a teacher; teacher is limited by role", async () => {
  const created = await call("POST", "/api/users", {
    token: admin,
    body: { name: "Test Teacher", email: teacherEmail, role: "teacher", password: teacherPassword, schoolId: 1 },
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  teacherId = created.json.id;
  const me = await call("GET", "/api/auth/me", { token: admin });
  assert.equal(created.json.schoolId, me.json.schoolId, "schoolId in body must be ignored");

  const teacher = await login(teacherEmail, teacherPassword);
  const items = await call("GET", "/api/compliance", { token: teacher });
  assert.equal(items.status, 200);
  const put = await call("PUT", `/api/compliance/${items.json.items[0].id}`, { token: teacher, body: { status: "compliant" } });
  assert.equal(put.status, 403);
  assert.equal((await call("GET", "/api/audit", { token: teacher })).status, 403);
  assert.equal((await call("PUT", "/api/settings", { token: teacher, body: { name: "Hacked" } })).status, 403);
  assert.equal((await call("POST", "/api/users", { token: teacher, body: { name: "Evil", email: "e@e.ng", role: "admin", password: "abcdefghijk" } })).status, 403);

  // Teachers can still report incidents
  const inc = await call("POST", "/api/incidents", { token: teacher, body: { type: "phishing", severity: "low", description: "Suspicious email received" } });
  assert.equal(inc.status, 201);
  assert.equal(inc.json.reportedBy, "Test Teacher");
});

test("tenant isolation: cannot read or modify another school's records", async () => {
  // Demo school's records (school #1 in a fresh DB) from the real school's admin
  const demoItems = await call("GET", "/api/compliance", { token: demo });
  const demoItemId = demoItems.json.items[0].id;
  const r = await call("PUT", `/api/compliance/${demoItemId}`, { token: admin, body: { status: "compliant" } });
  assert.equal(r.status, 404);

  const demoIncidents = await call("GET", "/api/incidents", { token: demo });
  const demoIncidentId = demoIncidents.json[0].id;
  assert.equal((await call("GET", `/api/incidents/${demoIncidentId}`, { token: admin })).status, 404);
  assert.equal((await call("PUT", `/api/incidents/${demoIncidentId}`, { token: admin, body: { status: "closed" } })).status, 404);
  assert.equal((await call("POST", `/api/incidents/${demoIncidentId}/actions`, { token: admin, body: { action: "pwned" } })).status, 404);

  const detail = await call("GET", `/api/incidents/${demoIncidentId}`, { token: demo });
  const actionId = detail.json.actions[0].id;
  assert.equal((await call("PUT", `/api/incident-actions/${actionId}`, { token: admin, body: { status: "completed" } })).status, 404);
});

test("mass assignment is blocked on settings", async () => {
  const before = await call("GET", "/api/settings", { token: admin });
  const r = await call("PUT", "/api/settings", { token: admin, body: { name: before.json.name, id: 999, isDemo: true } });
  assert.equal(r.status, 200);
  assert.equal(r.json.id, before.json.id);
  assert.equal(r.json.isDemo, false);
});

test("input validation", async () => {
  const bad = await call("POST", "/api/incidents", { token: admin, body: { type: "made_up", severity: "low", description: "hello world" } });
  assert.equal(bad.status, 400);
  const ip = await call("GET", "/api/ip-check/not-an-ip", { token: admin });
  assert.equal(ip.status, 400);
});

test("quiz answers are hidden and grading happens on the server", async () => {
  const courses = await call("GET", "/api/training/courses", { token: admin });
  assert.ok(courses.json.length > 0);
  const quiz = JSON.parse(courses.json[0].quizJson);
  assert.ok(quiz.every((q: any) => q.correct === undefined), "answer key must not be sent");

  const wrong = await call("POST", `/api/training/courses/${courses.json[0].id}/submit`, { token: admin, body: { answers: quiz.map(() => null) } });
  assert.equal(wrong.status, 200);
  assert.equal(wrong.json.score, 0);
  assert.equal(wrong.json.passed, false);

  const right = await call("POST", `/api/training/courses/${courses.json[0].id}/submit`, { token: admin, body: { answers: wrong.json.correctAnswers } });
  assert.equal(right.json.score, 100);
  assert.equal(right.json.passed, true);

  const progress = await call("GET", "/api/training/progress", { token: admin });
  assert.equal(progress.json.find((p: any) => p.courseId === courses.json[0].id)?.status, "completed");
});

test("demo is read-only and shows labelled sample data", async () => {
  assert.equal((await call("PUT", "/api/settings", { token: demo, body: { name: "x" } })).status, 403);
  assert.equal((await call("POST", "/api/incidents", { token: demo, body: { type: "phishing", severity: "low", description: "hello world" } })).status, 403);
  const threats = await call("GET", "/api/threats", { token: demo });
  assert.ok(threats.json.some((t: any) => t.isSample));
  const realThreats = await call("GET", "/api/threats", { token: admin });
  assert.ok(realThreats.json.every((t: any) => !t.isSample), "real schools never see sample threats");
  const news = await call("GET", "/api/news", { token: admin });
  assert.ok(news.json.every((n: any) => !n.isSample), "real schools never see sample news");
  // Quiz attempts are graded but not stored
  const courses = await call("GET", "/api/training/courses", { token: demo });
  const submit = await call("POST", `/api/training/courses/${courses.json[0].id}/submit`, { token: demo, body: { answers: [0] } });
  assert.equal(submit.status, 200);
});

test("deactivating a user revokes their sessions immediately", async () => {
  const teacher = await login(teacherEmail, teacherPassword);
  assert.equal((await call("PATCH", `/api/users/${teacherId}`, { token: admin, body: { isActive: false } })).status, 200);
  assert.equal((await call("GET", "/api/dashboard", { token: teacher })).status, 401);
  assert.equal((await call("POST", "/api/auth/login", { body: { email: teacherEmail, password: teacherPassword } })).status, 401);
});

test("admin cannot lock themselves out", async () => {
  const me = await call("GET", "/api/auth/me", { token: admin });
  assert.equal((await call("PATCH", `/api/users/${me.json.id}`, { token: admin, body: { isActive: false } })).status, 400);
  assert.equal((await call("PATCH", `/api/users/${me.json.id}`, { token: admin, body: { role: "staff" } })).status, 400);
});

test("changing password invalidates old tokens", async () => {
  const email = `pw${suffix}@test.ng`;
  await call("POST", "/api/users", { token: admin, body: { name: "Pw User", email, role: "staff", password: "FirstPassword1" } });
  const oldToken = await login(email, "FirstPassword1");
  const bad = await call("POST", "/api/auth/change-password", { token: oldToken, body: { currentPassword: "nope", newPassword: "SecondPassword2" } });
  assert.equal(bad.status, 400);
  const ok = await call("POST", "/api/auth/change-password", { token: oldToken, body: { currentPassword: "FirstPassword1", newPassword: "SecondPassword2" } });
  assert.equal(ok.status, 200);
  assert.equal((await call("GET", "/api/dashboard", { token: oldToken })).status, 401);
  assert.equal((await call("GET", "/api/dashboard", { token: ok.json.token })).status, 200);
  await login(email, "SecondPassword2");
});

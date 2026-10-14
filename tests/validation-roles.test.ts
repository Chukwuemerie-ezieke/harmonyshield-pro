import { describe, it, expect } from "vitest";
import request from "supertest";
import {
  getApp,
  auth,
  login,
  SCHOOL1_ADMIN,
  SCHOOL1_TEACHER,
} from "./helpers";

describe("role guards", () => {
  it("denies a teacher editing a compliance item (admin/dpo only) with 403", async () => {
    const app = await getApp();
    const teacherToken = await login(SCHOOL1_TEACHER);

    const res = await request(app)
      .put("/api/compliance/1")
      .set("Authorization", auth(teacherToken))
      .send({ status: "compliant" });

    expect(res.status).toBe(403);
  });

  it("denies a teacher editing settings (admin/dpo only) with 403", async () => {
    const app = await getApp();
    const teacherToken = await login(SCHOOL1_TEACHER);

    const res = await request(app)
      .put("/api/settings")
      .set("Authorization", auth(teacherToken))
      .send({ name: "Renamed School" });

    expect(res.status).toBe(403);
  });

  it("allows a teacher to create an incident (403 guard excludes this route)", async () => {
    // Positive control: teacher IS allowed on incident creation, so the 403s
    // above are role-specific, not a blanket teacher lockout.
    const app = await getApp();
    const teacherToken = await login(SCHOOL1_TEACHER);

    const res = await request(app)
      .post("/api/incidents")
      .set("Authorization", auth(teacherToken))
      .send({
        reportedBy: "Ibrahim Musa",
        type: "phishing",
        severity: "low",
        status: "investigating",
        description: "Suspicious email reported by a teacher.",
      });

    expect(res.status).toBe(201);
    expect(res.body.schoolId).toBe(1); // server-injected ownership
  });
});

describe("validation rejection", () => {
  it("rejects an invalid incident body (400)", async () => {
    const app = await getApp();
    const adminToken = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .post("/api/incidents")
      .set("Authorization", auth(adminToken))
      // `type` missing / wrong types: fails the zod schema.
      .send({ severity: 123, description: 456 });

    expect(res.status).toBe(400);
  });

  it("rejects an invalid compliance update body (400)", async () => {
    const app = await getApp();
    const adminToken = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .put("/api/compliance/1")
      .set("Authorization", auth(adminToken))
      .send({ weight: "not-a-number" });

    expect(res.status).toBe(400);
  });

  it("rejects an invalid settings body (400)", async () => {
    const app = await getApp();
    const adminToken = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .put("/api/settings")
      .set("Authorization", auth(adminToken))
      .send({ studentCount: "lots" });

    expect(res.status).toBe(400);
  });
});

describe("register lockdown", () => {
  it("rejects an unauthenticated register (401)", async () => {
    const app = await getApp();
    const res = await request(app).post("/api/auth/register").send({
      name: "Mallory",
      email: "mallory@evil.test",
      password: "password123",
      role: "admin",
      schoolId: 2,
    });

    expect(res.status).toBe(401);
  });

  it("rejects a teacher creating a user (admin only) with 403", async () => {
    const app = await getApp();
    const teacherToken = await login(SCHOOL1_TEACHER);

    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", auth(teacherToken))
      .send({
        name: "New Staff",
        email: "newstaff@fgcenugu.edu.ng",
        password: "password123",
        role: "staff",
      });

    expect(res.status).toBe(403);
  });

  it("forces an admin-created user into the admin's own school and ignores a chosen schoolId", async () => {
    const app = await getApp();
    const adminToken = await login(SCHOOL1_ADMIN); // school 1 admin

    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", auth(adminToken))
      .send({
        name: "Fresh Staffer",
        email: "fresh.staffer@fgcenugu.edu.ng",
        password: "password123",
        role: "staff",
        schoolId: 2, // attempt to plant into school 2 - must be ignored
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.schoolId).toBe(1); // forced to the admin's school
    expect(res.body.user.role).toBe("staff");
    expect(res.body).not.toHaveProperty("token"); // register returns no token
  });
});

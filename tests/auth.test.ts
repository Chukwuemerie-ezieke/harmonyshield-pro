import { describe, it, expect } from "vitest";
import request from "supertest";
import { getApp, auth, login, SCHOOL1_ADMIN } from "./helpers";

describe("auth", () => {
  it("logs in a seeded admin and returns a token + user (no password)", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: SCHOOL1_ADMIN, password: "demo123" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(0);
    expect(res.body.user.email).toBe(SCHOOL1_ADMIN);
    expect(res.body.user.schoolId).toBe(1);
    expect(res.body.user.role).toBe("admin");
    expect(res.body.user).not.toHaveProperty("password");
  });

  it("rejects a wrong password with 401", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: SCHOOL1_ADMIN, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it("rejects a missing body with 400", async () => {
    const app = await getApp();
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  it("rejects a protected route without a token (401)", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/compliance");
    expect(res.status).toBe(401);
  });

  it("rejects a protected route with an invalid token (401)", async () => {
    const app = await getApp();
    const res = await request(app)
      .get("/api/compliance")
      .set("Authorization", auth("not-a-real-token"));
    expect(res.status).toBe(401);
  });

  it("allows a protected route with a valid token (200)", async () => {
    const app = await getApp();
    const token = await login(SCHOOL1_ADMIN);
    const res = await request(app)
      .get("/api/compliance")
      .set("Authorization", auth(token));
    expect(res.status).toBe(200);
  });
});

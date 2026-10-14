import { describe, it, expect } from "vitest";
import request from "supertest";
import { getApp, auth, login, SCHOOL1_ADMIN } from "./helpers";

describe("healthz", () => {
  it("returns 200 with status, uptime and timestamp without auth", async () => {
    const app = await getApp();
    const res = await request(app).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
    expect(typeof res.body.timestamp).toBe("string");
    expect(res.body.db).toBe("up");
    // never leak secrets
    expect(res.body).not.toHaveProperty("token");
  });
});

describe("session revocation / logout", () => {
  it("login creates a session that lets a protected route succeed", async () => {
    const app = await getApp();
    const token = await login(SCHOOL1_ADMIN);

    const protectedRes = await request(app)
      .get("/api/compliance")
      .set("Authorization", auth(token));
    expect(protectedRes.status).toBe(200);

    const sessionsRes = await request(app)
      .get("/api/auth/sessions")
      .set("Authorization", auth(token));
    expect(sessionsRes.status).toBe(200);
    expect(Array.isArray(sessionsRes.body.sessions)).toBe(true);
    expect(sessionsRes.body.sessions.length).toBe(1);
    expect(sessionsRes.body.sessions[0].current).toBe(true);
    // sessions endpoint must not expose the jti/token value
    expect(sessionsRes.body.sessions[0]).not.toHaveProperty("token");
  });

  it("logout invalidates the token so a later protected request returns 401", async () => {
    const app = await getApp();
    const token = await login(SCHOOL1_ADMIN);

    // token works before logout
    const before = await request(app)
      .get("/api/compliance")
      .set("Authorization", auth(token));
    expect(before.status).toBe(200);

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", auth(token));
    expect(logoutRes.status).toBe(200);

    // same token is now revoked
    const after = await request(app)
      .get("/api/compliance")
      .set("Authorization", auth(token));
    expect(after.status).toBe(401);

    // and /api/auth/me also rejects it
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", auth(token));
    expect(meRes.status).toBe(401);
  });

  it("rejects logout without a token (401)", async () => {
    const app = await getApp();
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(401);
  });
});

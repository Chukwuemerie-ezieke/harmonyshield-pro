import { describe, it, expect } from "vitest";
import request from "supertest";
import { getApp, auth, login, SCHOOL1_ADMIN, SCHOOL2_ADMIN } from "./helpers";

/**
 * Cross-school ownership denial.
 *
 * The seed only creates compliance items (ids 1-15) and incidents (ids 1-3)
 * for school 1. A school-2 admin therefore owns none of them. verifyOwnership
 * must reject the cross-school access with 403 (the record exists but belongs
 * to another school). These tests FAIL if the ownership guard is removed from
 * the route, because the handler would then succeed with 200.
 */
describe("cross-school ownership", () => {
  it("denies a school-2 admin PUT on a school-1 compliance item (403)", async () => {
    const app = await getApp();
    const school2Token = await login(SCHOOL2_ADMIN);

    const res = await request(app)
      .put("/api/compliance/1") // compliance item 1 belongs to school 1
      .set("Authorization", auth(school2Token))
      .send({ status: "compliant" });

    expect(res.status).toBe(403);
  });

  it("allows the owning school-1 admin to PUT the same compliance item (200)", async () => {
    // Positive control: the same request from the owning school succeeds. If
    // this passed for school 2 as well, the ownership test above would be
    // meaningless.
    const app = await getApp();
    const school1Token = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .put("/api/compliance/1")
      .set("Authorization", auth(school1Token))
      .send({ status: "compliant" });

    expect(res.status).toBe(200);
  });

  it("denies a school-2 admin GET on a school-1 incident (403)", async () => {
    const app = await getApp();
    const school2Token = await login(SCHOOL2_ADMIN);

    const res = await request(app)
      .get("/api/incidents/1") // incident 1 belongs to school 1
      .set("Authorization", auth(school2Token));

    expect(res.status).toBe(403);
  });

  it("denies a school-2 admin PUT on a school-1 incident (403)", async () => {
    const app = await getApp();
    const school2Token = await login(SCHOOL2_ADMIN);

    const res = await request(app)
      .put("/api/incidents/1")
      .set("Authorization", auth(school2Token))
      .send({ status: "resolved" });

    expect(res.status).toBe(403);
  });

  it("returns 404 (not 403) for an incident that does not exist in any school", async () => {
    const app = await getApp();
    const school1Token = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .get("/api/incidents/99999")
      .set("Authorization", auth(school1Token));

    expect(res.status).toBe(404);
  });

  it("scopes GET /api/incidents to the caller's school (school 2 sees none)", async () => {
    const app = await getApp();
    const school2Token = await login(SCHOOL2_ADMIN);

    const res = await request(app)
      .get("/api/incidents")
      .set("Authorization", auth(school2Token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // All seeded incidents belong to school 1, so school 2 sees an empty list.
    expect(res.body).toHaveLength(0);
  });
});

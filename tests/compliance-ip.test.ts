import { describe, it, expect } from "vitest";
import request from "supertest";
import { getApp, auth, login, SCHOOL1_ADMIN, SCHOOL2_ADMIN } from "./helpers";

describe("compliance weighted scoring", () => {
  it("computes the seeded school-1 score with the compliant=full / partial=0.5 formula (52)", async () => {
    const app = await getApp();
    const token = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .get("/api/compliance")
      .set("Authorization", auth(token));

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(15);

    // Independently recompute the weighted score from the returned items to
    // prove the formula (compliant counts full weight, partial counts half,
    // everything else zero) and that it matches the known seed value of 52.
    const totalWeight = res.body.items.reduce(
      (sum: number, i: any) => sum + (i.weight || 5),
      0,
    );
    const compliantWeight = res.body.items
      .filter((i: any) => i.status === "compliant")
      .reduce((sum: number, i: any) => sum + (i.weight || 5), 0);
    const partialWeight = res.body.items
      .filter((i: any) => i.status === "partial")
      .reduce((sum: number, i: any) => sum + (i.weight || 5), 0);
    const expected = Math.round(
      ((compliantWeight + partialWeight * 0.5) / totalWeight) * 100,
    );

    expect(expected).toBe(52);
    expect(res.body.score).toBe(52);
  });

  it("returns a 0 score for a school with no compliance items (school 2)", async () => {
    const app = await getApp();
    const token = await login(SCHOOL2_ADMIN);

    const res = await request(app)
      .get("/api/compliance")
      .set("Authorization", auth(token));

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.score).toBe(0);
  });
});

describe("AbuseIPDB unavailable", () => {
  it("returns 503 with no fabricated numbers when ABUSEIPDB_API_KEY is not set", async () => {
    // ABUSEIPDB_API_KEY is unset in the test env, so the reputation source is
    // unavailable. The route must signal that with 503 and must NOT invent a
    // confidence/score. (No network is hit in this path.)
    expect(process.env.ABUSEIPDB_API_KEY).toBeFalsy();

    const app = await getApp();
    const token = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .get("/api/ip-check/8.8.8.8")
      .set("Authorization", auth(token));

    expect(res.status).toBe(503);
    expect(res.body.available).toBe(false);
    expect(res.body.source).toBe("unavailable");
    expect(res.body.message).toBe(
      "IP reputation unavailable - ABUSEIPDB_API_KEY not configured",
    );
    // No fabricated reputation numbers may leak through.
    expect(res.body).not.toHaveProperty("abuseConfidenceScore");
    expect(res.body).not.toHaveProperty("score");
    expect(res.body).not.toHaveProperty("totalReports");
  });
});

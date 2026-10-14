import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// Keep the suite deterministic and offline: stub the live-feed fetchers so the
// threats/news routes never reach out to RSS/OTX/AbuseIPDB. We preserve the
// real checkIPReputation and getFeedStatus so their (offline, key-less)
// behavior is still exercised elsewhere.
vi.mock("../server/live-feeds", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/live-feeds")>();
  return {
    ...actual,
    fetchOTXThreats: vi.fn(async () => []),
    fetchLiveNews: vi.fn(async () => []),
  };
});

// Import helpers AFTER the mock is declared (vi.mock is hoisted anyway).
import { getApp, auth, login, SCHOOL1_ADMIN } from "./helpers";

describe("threats/news routes (live feeds stubbed)", () => {
  it("returns the 12 seeded threats and no live threats", async () => {
    const app = await getApp();
    const token = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .get("/api/threats")
      .set("Authorization", auth(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // With live feeds stubbed to [], only the 12 seeded threats remain.
    expect(res.body).toHaveLength(12);
    expect(res.body.every((t: any) => t.isLive === false)).toBe(true);
  });

  it("returns news without hitting the network (seeded only)", async () => {
    const app = await getApp();
    const token = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .get("/api/news")
      .set("Authorization", auth(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import request from "supertest";
import {
  getApp,
  auth,
  login,
  SCHOOL1_ADMIN,
  SCHOOL1_TEACHER,
  SCHOOL2_ADMIN,
} from "./helpers";

/**
 * Report export (CSV) and compliance evidence upload.
 *
 * All offline: file uploads use supertest .attach with an in-memory buffer and
 * no network is touched. The seed only creates compliance items (ids 1-15) for
 * school 1, so a school-2 user owns none of them.
 */
describe("reports export", () => {
  it("returns a CSV with compliance + incident summary for the caller's school", async () => {
    const app = await getApp();
    const token = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .get("/api/reports/export?format=csv")
      .set("Authorization", auth(token));

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain(
      "harmonyshield-report.csv",
    );

    const csv = res.text;
    // Summary + section headers must be present.
    expect(csv).toContain("HarmonyShield Compliance Report");
    expect(csv).toContain("Compliance Score");
    expect(csv).toContain("Title,Status,Weight");
    expect(csv).toContain("Type,Severity,Status");
    // A seeded school-1 compliance item title should appear.
    expect(csv).toContain("NDPC Registration");
  });

  it("rejects an unknown export format with 400", async () => {
    const app = await getApp();
    const token = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .get("/api/reports/export?format=xml")
      .set("Authorization", auth(token));

    expect(res.status).toBe(400);
  });

  it("returns a PDF with the correct content type for format=pdf", async () => {
    const app = await getApp();
    const token = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .get("/api/reports/export?format=pdf")
      .set("Authorization", auth(token))
      .buffer(true)
      .parse((response, cb) => {
        const data: Buffer[] = [];
        response.on("data", (chunk) => data.push(Buffer.from(chunk)));
        response.on("end", () => cb(null, Buffer.concat(data)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain(
      "harmonyshield-report.pdf",
    );
    // Every PDF file begins with the "%PDF" magic bytes.
    expect(res.body.slice(0, 4).toString("latin1")).toBe("%PDF");
  });
});

describe("compliance evidence upload", () => {
  it("accepts a valid in-size, allowed-type file for an owned compliance item", async () => {
    const app = await getApp();
    const token = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .post("/api/compliance/1/evidence") // item 1 belongs to school 1
      .set("Authorization", auth(token))
      .attach("file", Buffer.from("evidence contents"), {
        filename: "evidence.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(201);
    expect(res.body.originalName).toBe("evidence.txt");
    expect(res.body.complianceItemId).toBe(1);
    expect(res.body.schoolId).toBe(1);
  });

  it("lists uploaded evidence for an owned compliance item", async () => {
    const app = await getApp();
    const token = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .get("/api/compliance/1/evidence")
      .set("Authorization", auth(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects a disallowed file type with 400", async () => {
    const app = await getApp();
    const token = await login(SCHOOL1_ADMIN);

    const res = await request(app)
      .post("/api/compliance/1/evidence")
      .set("Authorization", auth(token))
      .attach("file", Buffer.from("MZ..."), {
        filename: "malware.exe",
        contentType: "application/x-msdownload",
      });

    expect(res.status).toBe(400);
  });

  it("denies a school-2 admin uploading to a school-1 compliance item (403)", async () => {
    const app = await getApp();
    const token = await login(SCHOOL2_ADMIN);

    const res = await request(app)
      .post("/api/compliance/1/evidence") // item 1 belongs to school 1
      .set("Authorization", auth(token))
      .attach("file", Buffer.from("evidence contents"), {
        filename: "evidence.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(403);
  });

  it("forbids a teacher (wrong role) from uploading evidence (403)", async () => {
    const app = await getApp();
    const token = await login(SCHOOL1_TEACHER);

    const res = await request(app)
      .post("/api/compliance/1/evidence")
      .set("Authorization", auth(token))
      .attach("file", Buffer.from("evidence contents"), {
        filename: "evidence.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(403);
  });
});

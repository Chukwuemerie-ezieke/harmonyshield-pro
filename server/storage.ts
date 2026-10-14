import { eq, and, desc } from "drizzle-orm";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import Database from "better-sqlite3";
import { Pool } from "pg";
import * as sqliteSchema from "./db-schema";
import * as pgSchema from "@shared/schema";

/**
 * Dual-driver storage layer.
 *
 * HarmonyShield Pro runs on SQLite by default (zero-config dev/test) and on
 * PostgreSQL in production when DATABASE_URL is provided. The driver is chosen
 * once at module load:
 *
 *   - DATABASE_URL set  -> drizzle-orm/node-postgres with the pgTable schema
 *                          from shared/schema.ts (async query API).
 *   - DATABASE_URL unset -> drizzle-orm/better-sqlite3 with the sqliteTable
 *                          schema from server/db-schema.ts (sync query API).
 *
 * Every public storage method is `async` so the single IStorage interface
 * serves both drivers: SQLite's synchronous results are simply returned from an
 * async method (and therefore wrapped in a resolved Promise), while the
 * node-postgres calls are awaited.
 *
 * The two dialects expose different table objects and different query
 * terminators (SQLite uses .get()/.all()/.run(); node-postgres returns arrays
 * from awaited builders). We isolate those differences in a small `exec` helper
 * and a single `schema`/`db` pair, so the method bodies read the same for both
 * drivers.
 */

const usePostgres = Boolean(process.env.DATABASE_URL);

// A single schema/db pair that the rest of the file references. The concrete
// table objects differ by dialect but share identical column names, so the
// drizzle query builder calls below are structurally identical.
type Schema = typeof sqliteSchema;

let db: any;
let schema: Schema;

if (usePostgres) {
  // ─── PostgreSQL (production) ──────────────────────────
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzlePg(pool, { schema: pgSchema });
  // The pgTable objects share column names with the sqliteTable mirror, so the
  // query-building code below is identical across dialects.
  schema = pgSchema as unknown as Schema;
  console.log("[Storage] Using PostgreSQL driver (DATABASE_URL set)");
} else {
  // ─── SQLite (default dev/test) ────────────────────────
  // The SQLite file path defaults to `data.db` but can be overridden via
  // SQLITE_PATH (or DATABASE_FILE) so the test suite can point at an isolated,
  // throwaway database and never clobber the dev `data.db`. Use ":memory:" for
  // an in-memory database.
  const sqlitePath = process.env.SQLITE_PATH || process.env.DATABASE_FILE || "data.db";
  const sqlite = new Database(sqlitePath);
  sqlite.pragma("journal_mode = WAL");
  db = drizzleSqlite(sqlite);
  schema = sqliteSchema;

  // Create all tables for the SQLite dev/test runtime. On PostgreSQL the schema
  // is created via committed Drizzle migrations (see migrations/ and
  // DEPLOYMENT_GUIDE.md) rather than at runtime.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      state TEXT,
      lga TEXT,
      type TEXT NOT NULL DEFAULT 'secondary',
      student_count INTEGER DEFAULT 0,
      ndpc_reg_number TEXT,
      created_at TEXT NOT NULL DEFAULT 'now()'
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      department TEXT,
      created_at TEXT NOT NULL DEFAULT 'now()'
    );

    CREATE TABLE IF NOT EXISTS compliance_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      item_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'not_started',
      weight INTEGER DEFAULT 5,
      due_date TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS threats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      type TEXT NOT NULL DEFAULT 'malware',
      published_at TEXT NOT NULL,
      country TEXT,
      is_education_sector INTEGER DEFAULT 0,
      ioc_data TEXT
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      reported_by TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      step INTEGER DEFAULT 1,
      description TEXT NOT NULL,
      affected_systems TEXT,
      affected_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS incident_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      performed_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS training_courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      duration_min INTEGER DEFAULT 30,
      icon TEXT,
      content_md TEXT,
      quiz_json TEXT,
      pass_mark INTEGER DEFAULT 70
    );

    CREATE TABLE IF NOT EXISTS training_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      score INTEGER,
      started_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS news_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      url TEXT,
      summary TEXT,
      published_at TEXT NOT NULL,
      keywords TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  console.log("[Storage] Using SQLite driver (DATABASE_URL not set)");
}

export { db };

// ─── Dialect-agnostic query terminators ───────────────
// better-sqlite3 drizzle builders are synchronous and terminate with
// .get()/.all()/.run(); node-postgres builders are thenables that resolve to a
// result set. These helpers normalize both into Promises.

/** Return the first row (or undefined) from a select/insert/update builder. */
async function first<T = any>(builder: any): Promise<T | undefined> {
  if (usePostgres) {
    const rows = await builder;
    return (rows as T[])[0];
  }
  return builder.get() as T | undefined;
}

/** Return all rows from a select builder. */
async function many<T = any>(builder: any): Promise<T[]> {
  if (usePostgres) {
    const rows = await builder;
    return rows as T[];
  }
  return builder.all() as T[];
}

/** Execute a statement without caring about the result (e.g. deletes). */
async function run(builder: any): Promise<void> {
  if (usePostgres) {
    await builder;
    return;
  }
  builder.run();
}

const {
  schools, users, complianceItems, threats, incidents, incidentActions,
  trainingCourses, trainingProgress, newsArticles, auditLog, sessions,
} = schema;

export interface IStorage {
  // Schools
  getSchools(): Promise<any[]>;
  getSchool(id: number): Promise<any | undefined>;
  createSchool(data: any): Promise<any>;
  updateSchool(id: number, data: Partial<any>): Promise<any | undefined>;

  // Users
  getUser(id: number): Promise<any | undefined>;
  getUserByEmail(email: string): Promise<any | undefined>;
  getUsers(schoolId: number): Promise<any[]>;
  createUser(data: any): Promise<any>;

  // Compliance
  getComplianceItems(schoolId: number): Promise<any[]>;
  getComplianceItem(id: number): Promise<any | undefined>;
  getComplianceScore(schoolId: number): Promise<number>;
  createComplianceItem(data: any): Promise<any>;
  updateComplianceItem(id: number, data: Partial<any>): Promise<any | undefined>;

  // Threats
  getThreats(): Promise<any[]>;
  getThreatStats(): Promise<{ total: number; critical: number; high: number; medium: number; low: number }>;
  createThreat(data: any): Promise<any>;

  // Incidents
  getIncidents(schoolId: number): Promise<any[]>;
  getIncident(id: number): Promise<any | undefined>;
  createIncident(data: any): Promise<any>;
  updateIncident(id: number, data: Partial<any>): Promise<any | undefined>;

  // Incident Actions
  getIncidentActions(incidentId: number): Promise<any[]>;
  getIncidentAction(id: number): Promise<any | undefined>;
  createIncidentAction(data: any): Promise<any>;
  updateIncidentAction(id: number, data: Partial<any>): Promise<any | undefined>;

  // Training
  getCourses(): Promise<any[]>;
  getCourse(id: number): Promise<any | undefined>;
  createCourse(data: any): Promise<any>;
  getTrainingProgress(userId: number): Promise<any[]>;
  upsertTrainingProgress(data: { userId: number; courseId: number; status: string; score?: number }): Promise<any>;

  // News
  getNewsArticles(): Promise<any[]>;
  createNewsArticle(data: any): Promise<any>;

  // Audit
  getAuditLog(schoolId: number): Promise<any[]>;
  createAuditEntry(data: any): Promise<any>;

  // Sessions
  createSession(data: any): Promise<any>;
  getSession(token: string): Promise<any | undefined>;
  deleteSession(token: string): Promise<void>;

  // Dashboard
  getDashboardStats(schoolId: number, userId: number): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // ─── Schools ───────────────────────────────────────
  async getSchools() {
    return many(db.select().from(schools));
  }

  async getSchool(id: number) {
    return first(db.select().from(schools).where(eq(schools.id, id)));
  }

  async createSchool(data: any) {
    return first(db.insert(schools).values({
      ...data,
      createdAt: new Date().toISOString(),
    }).returning());
  }

  async updateSchool(id: number, data: Partial<any>) {
    return first(db.update(schools).set(data).where(eq(schools.id, id)).returning());
  }

  // ─── Users ─────────────────────────────────────────
  async getUser(id: number) {
    return first(db.select().from(users).where(eq(users.id, id)));
  }

  async getUserByEmail(email: string) {
    return first(db.select().from(users).where(eq(users.email, email)));
  }

  async getUsers(schoolId: number) {
    return many(db.select({
      id: users.id,
      schoolId: users.schoolId,
      email: users.email,
      name: users.name,
      role: users.role,
      department: users.department,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.schoolId, schoolId)));
  }

  async createUser(data: any) {
    return first(db.insert(users).values({
      ...data,
      createdAt: new Date().toISOString(),
    }).returning());
  }

  // ─── Compliance ────────────────────────────────────
  async getComplianceItems(schoolId: number) {
    return many(db.select().from(complianceItems).where(eq(complianceItems.schoolId, schoolId)));
  }

  async getComplianceItem(id: number) {
    return first(db.select().from(complianceItems).where(eq(complianceItems.id, id)));
  }

  async getComplianceScore(schoolId: number) {
    const items = await this.getComplianceItems(schoolId);
    if (items.length === 0) return 0;
    const totalWeight = items.reduce((sum, i) => sum + (i.weight || 5), 0);
    const completedWeight = items
      .filter(i => i.status === "compliant")
      .reduce((sum, i) => sum + (i.weight || 5), 0);
    const partialWeight = items
      .filter(i => i.status === "partial")
      .reduce((sum, i) => sum + ((i.weight || 5) * 0.5), 0);
    return Math.round(((completedWeight + partialWeight) / totalWeight) * 100);
  }

  async createComplianceItem(data: any) {
    return first(db.insert(complianceItems).values({
      ...data,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    }).returning());
  }

  async updateComplianceItem(id: number, data: Partial<any>) {
    return first(db.update(complianceItems).set({
      ...data,
      updatedAt: new Date().toISOString(),
    }).where(eq(complianceItems.id, id)).returning());
  }

  // ─── Threats ───────────────────────────────────────
  async getThreats() {
    return many(db.select().from(threats).orderBy(desc(threats.publishedAt)));
  }

  async getThreatStats() {
    const all = await this.getThreats();
    return {
      total: all.length,
      critical: all.filter(t => t.severity === "critical").length,
      high: all.filter(t => t.severity === "high").length,
      medium: all.filter(t => t.severity === "medium").length,
      low: all.filter(t => t.severity === "low").length,
    };
  }

  async createThreat(data: any) {
    return first(db.insert(threats).values(data).returning());
  }

  // ─── Incidents ─────────────────────────────────────
  async getIncidents(schoolId: number) {
    return many(db.select().from(incidents).where(eq(incidents.schoolId, schoolId)).orderBy(desc(incidents.createdAt)));
  }

  async getIncident(id: number) {
    return first(db.select().from(incidents).where(eq(incidents.id, id)));
  }

  async createIncident(data: any) {
    return first(db.insert(incidents).values({
      ...data,
      createdAt: new Date().toISOString(),
    }).returning());
  }

  async updateIncident(id: number, data: Partial<any>) {
    return first(db.update(incidents).set(data).where(eq(incidents.id, id)).returning());
  }

  // ─── Incident Actions ──────────────────────────────
  async getIncidentActions(incidentId: number) {
    return many(db.select().from(incidentActions).where(eq(incidentActions.incidentId, incidentId)).orderBy(desc(incidentActions.createdAt)));
  }

  async getIncidentAction(id: number) {
    return first(db.select().from(incidentActions).where(eq(incidentActions.id, id)));
  }

  async createIncidentAction(data: any) {
    return first(db.insert(incidentActions).values({
      ...data,
      createdAt: new Date().toISOString(),
    }).returning());
  }

  async updateIncidentAction(id: number, data: Partial<any>) {
    return first(db.update(incidentActions).set(data).where(eq(incidentActions.id, id)).returning());
  }

  // ─── Training ──────────────────────────────────────
  async getCourses() {
    return many(db.select().from(trainingCourses));
  }

  async getCourse(id: number) {
    return first(db.select().from(trainingCourses).where(eq(trainingCourses.id, id)));
  }

  async createCourse(data: any) {
    return first(db.insert(trainingCourses).values(data).returning());
  }

  async getTrainingProgress(userId: number) {
    return many(db.select().from(trainingProgress).where(eq(trainingProgress.userId, userId)));
  }

  async upsertTrainingProgress(data: { userId: number; courseId: number; status: string; score?: number }) {
    const existing = await first<any>(db.select().from(trainingProgress)
      .where(and(
        eq(trainingProgress.userId, data.userId),
        eq(trainingProgress.courseId, data.courseId)
      )));

    if (existing) {
      return first(db.update(trainingProgress).set({
        status: data.status,
        score: data.score ?? existing.score,
        completedAt: data.status === "completed" ? new Date().toISOString() : existing.completedAt,
      }).where(eq(trainingProgress.id, existing.id)).returning());
    } else {
      return first(db.insert(trainingProgress).values({
        userId: data.userId,
        courseId: data.courseId,
        status: data.status,
        score: data.score ?? null,
        startedAt: new Date().toISOString(),
        completedAt: data.status === "completed" ? new Date().toISOString() : null,
      }).returning());
    }
  }

  // ─── News ──────────────────────────────────────────
  async getNewsArticles() {
    return many(db.select().from(newsArticles).orderBy(desc(newsArticles.publishedAt)));
  }

  async createNewsArticle(data: any) {
    return first(db.insert(newsArticles).values(data).returning());
  }

  // ─── Audit ─────────────────────────────────────────
  async getAuditLog(schoolId: number) {
    return many(db.select().from(auditLog).where(eq(auditLog.schoolId, schoolId)).orderBy(desc(auditLog.timestamp)));
  }

  async createAuditEntry(data: any) {
    return first(db.insert(auditLog).values({
      ...data,
      timestamp: new Date().toISOString(),
    }).returning());
  }

  // ─── Sessions ──────────────────────────────────────
  async createSession(data: any) {
    return first(db.insert(sessions).values({
      ...data,
      createdAt: new Date().toISOString(),
    }).returning());
  }

  async getSession(token: string) {
    return first(db.select().from(sessions).where(eq(sessions.token, token)));
  }

  async deleteSession(token: string) {
    await run(db.delete(sessions).where(eq(sessions.token, token)));
  }

  // ─── Dashboard ─────────────────────────────────────
  async getDashboardStats(schoolId: number, userId: number) {
    const complianceScore = await this.getComplianceScore(schoolId);
    const allThreats = await this.getThreats();
    const activeThreats = allThreats.filter(t => t.severity === "critical" || t.severity === "high").length;
    const schoolIncidents = await this.getIncidents(schoolId);
    const activeIncidents = schoolIncidents.filter(i => i.status !== "resolved" && i.status !== "closed").length;

    // Training completion
    const allCourses = await this.getCourses();
    const userProgress = await this.getTrainingProgress(userId);
    const completedCourses = userProgress.filter(p => p.status === "completed").length;
    const trainingCompletion = allCourses.length > 0
      ? Math.round((completedCourses / allCourses.length) * 100)
      : 0;

    return {
      complianceScore,
      activeThreats,
      totalThreats: allThreats.length,
      activeIncidents,
      totalIncidents: schoolIncidents.length,
      trainingCompletion,
      totalCourses: allCourses.length,
      completedCourses,
      recentIncidents: schoolIncidents.slice(0, 5),
      threatStats: await this.getThreatStats(),
    };
  }
}

export const storage = new DatabaseStorage();

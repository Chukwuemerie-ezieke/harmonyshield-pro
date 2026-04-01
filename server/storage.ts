import type {
  School, InsertSchool,
  User, InsertUser,
  ComplianceItem, InsertComplianceItem,
  Threat, InsertThreat,
  Incident, InsertIncident,
  IncidentAction, InsertIncidentAction,
  TrainingCourse,
  TrainingProgress,
  NewsArticle,
  AuditLogEntry,
  Session,
} from "@shared/schema";

import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, sql, desc, count } from "drizzle-orm";
import {
  schools, users, complianceItems, threats, incidents, incidentActions,
  trainingCourses, trainingProgress, newsArticles, auditLog, sessions,
} from "./db-schema";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
export const db = drizzle(sqlite);

// Create all tables
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

export interface IStorage {
  // Schools
  getSchools(): any[];
  getSchool(id: number): any | undefined;
  createSchool(data: any): any;
  updateSchool(id: number, data: Partial<any>): any | undefined;

  // Users
  getUser(id: number): any | undefined;
  getUserByEmail(email: string): any | undefined;
  getUsers(schoolId: number): any[];
  createUser(data: any): any;

  // Compliance
  getComplianceItems(schoolId: number): any[];
  getComplianceScore(schoolId: number): number;
  updateComplianceItem(id: number, data: Partial<any>): any | undefined;

  // Threats
  getThreats(): any[];
  getThreatStats(): { total: number; critical: number; high: number; medium: number; low: number };
  createThreat(data: any): any;

  // Incidents
  getIncidents(schoolId: number): any[];
  getIncident(id: number): any | undefined;
  createIncident(data: any): any;
  updateIncident(id: number, data: Partial<any>): any | undefined;

  // Incident Actions
  getIncidentActions(incidentId: number): any[];
  createIncidentAction(data: any): any;
  updateIncidentAction(id: number, data: Partial<any>): any | undefined;

  // Training
  getCourses(): any[];
  getCourse(id: number): any | undefined;
  getTrainingProgress(userId: number): any[];
  upsertTrainingProgress(data: { userId: number; courseId: number; status: string; score?: number }): any;

  // News
  getNewsArticles(): any[];
  createNewsArticle(data: any): any;

  // Audit
  getAuditLog(schoolId: number): any[];
  createAuditEntry(data: any): any;

  // Sessions
  createSession(data: any): any;
  getSession(token: string): any | undefined;
  deleteSession(token: string): void;

  // Dashboard
  getDashboardStats(schoolId: number, userId: number): any;
}

export class DatabaseStorage implements IStorage {
  // ─── Schools ───────────────────────────────────────
  getSchools() {
    return db.select().from(schools).all();
  }

  getSchool(id: number) {
    return db.select().from(schools).where(eq(schools.id, id)).get();
  }

  createSchool(data: any) {
    return db.insert(schools).values({
      ...data,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }

  updateSchool(id: number, data: Partial<any>) {
    return db.update(schools).set(data).where(eq(schools.id, id)).returning().get();
  }

  // ─── Users ─────────────────────────────────────────
  getUser(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  getUserByEmail(email: string) {
    return db.select().from(users).where(eq(users.email, email)).get();
  }

  getUsers(schoolId: number) {
    return db.select({
      id: users.id,
      schoolId: users.schoolId,
      email: users.email,
      name: users.name,
      role: users.role,
      department: users.department,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.schoolId, schoolId)).all();
  }

  createUser(data: any) {
    return db.insert(users).values({
      ...data,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }

  // ─── Compliance ────────────────────────────────────
  getComplianceItems(schoolId: number) {
    return db.select().from(complianceItems).where(eq(complianceItems.schoolId, schoolId)).all();
  }

  getComplianceScore(schoolId: number) {
    const items = this.getComplianceItems(schoolId);
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

  updateComplianceItem(id: number, data: Partial<any>) {
    return db.update(complianceItems).set({
      ...data,
      updatedAt: new Date().toISOString(),
    }).where(eq(complianceItems.id, id)).returning().get();
  }

  // ─── Threats ───────────────────────────────────────
  getThreats() {
    return db.select().from(threats).orderBy(desc(threats.publishedAt)).all();
  }

  getThreatStats() {
    const all = this.getThreats();
    return {
      total: all.length,
      critical: all.filter(t => t.severity === "critical").length,
      high: all.filter(t => t.severity === "high").length,
      medium: all.filter(t => t.severity === "medium").length,
      low: all.filter(t => t.severity === "low").length,
    };
  }

  createThreat(data: any) {
    return db.insert(threats).values(data).returning().get();
  }

  // ─── Incidents ─────────────────────────────────────
  getIncidents(schoolId: number) {
    return db.select().from(incidents).where(eq(incidents.schoolId, schoolId)).orderBy(desc(incidents.createdAt)).all();
  }

  getIncident(id: number) {
    return db.select().from(incidents).where(eq(incidents.id, id)).get();
  }

  createIncident(data: any) {
    return db.insert(incidents).values({
      ...data,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }

  updateIncident(id: number, data: Partial<any>) {
    return db.update(incidents).set(data).where(eq(incidents.id, id)).returning().get();
  }

  // ─── Incident Actions ──────────────────────────────
  getIncidentActions(incidentId: number) {
    return db.select().from(incidentActions).where(eq(incidentActions.incidentId, incidentId)).orderBy(desc(incidentActions.createdAt)).all();
  }

  createIncidentAction(data: any) {
    return db.insert(incidentActions).values({
      ...data,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }

  updateIncidentAction(id: number, data: Partial<any>) {
    return db.update(incidentActions).set(data).where(eq(incidentActions.id, id)).returning().get();
  }

  // ─── Training ──────────────────────────────────────
  getCourses() {
    return db.select().from(trainingCourses).all();
  }

  getCourse(id: number) {
    return db.select().from(trainingCourses).where(eq(trainingCourses.id, id)).get();
  }

  getTrainingProgress(userId: number) {
    return db.select().from(trainingProgress).where(eq(trainingProgress.userId, userId)).all();
  }

  upsertTrainingProgress(data: { userId: number; courseId: number; status: string; score?: number }) {
    const existing = db.select().from(trainingProgress)
      .where(and(
        eq(trainingProgress.userId, data.userId),
        eq(trainingProgress.courseId, data.courseId)
      )).get();

    if (existing) {
      return db.update(trainingProgress).set({
        status: data.status,
        score: data.score ?? existing.score,
        completedAt: data.status === "completed" ? new Date().toISOString() : existing.completedAt,
      }).where(eq(trainingProgress.id, existing.id)).returning().get();
    } else {
      return db.insert(trainingProgress).values({
        userId: data.userId,
        courseId: data.courseId,
        status: data.status,
        score: data.score ?? null,
        startedAt: new Date().toISOString(),
        completedAt: data.status === "completed" ? new Date().toISOString() : null,
      }).returning().get();
    }
  }

  // ─── News ──────────────────────────────────────────
  getNewsArticles() {
    return db.select().from(newsArticles).orderBy(desc(newsArticles.publishedAt)).all();
  }

  createNewsArticle(data: any) {
    return db.insert(newsArticles).values(data).returning().get();
  }

  // ─── Audit ─────────────────────────────────────────
  getAuditLog(schoolId: number) {
    return db.select().from(auditLog).where(eq(auditLog.schoolId, schoolId)).orderBy(desc(auditLog.timestamp)).all();
  }

  createAuditEntry(data: any) {
    return db.insert(auditLog).values({
      ...data,
      timestamp: new Date().toISOString(),
    }).returning().get();
  }

  // ─── Sessions ──────────────────────────────────────
  createSession(data: any) {
    return db.insert(sessions).values({
      ...data,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }

  getSession(token: string) {
    return db.select().from(sessions).where(eq(sessions.token, token)).get();
  }

  deleteSession(token: string) {
    db.delete(sessions).where(eq(sessions.token, token)).run();
  }

  // ─── Dashboard ─────────────────────────────────────
  getDashboardStats(schoolId: number, userId: number) {
    const complianceScore = this.getComplianceScore(schoolId);
    const allThreats = this.getThreats();
    const activeThreats = allThreats.filter(t => t.severity === "critical" || t.severity === "high").length;
    const schoolIncidents = this.getIncidents(schoolId);
    const activeIncidents = schoolIncidents.filter(i => i.status !== "resolved" && i.status !== "closed").length;

    // Training completion
    const allCourses = this.getCourses();
    const userProgress = this.getTrainingProgress(userId);
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
      threatStats: this.getThreatStats(),
    };
  }
}

export const storage = new DatabaseStorage();

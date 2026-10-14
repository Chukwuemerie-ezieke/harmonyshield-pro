/**
 * SQLite runtime schema — mirrors shared/schema.ts (pgTable) but uses sqliteTable.
 * This allows the app to run with better-sqlite3 locally while keeping
 * the shared types compatible with PostgreSQL for production deployment.
 * 
 * To migrate to PostgreSQL: swap this file's imports to use the pg tables
 * from shared/schema.ts and change the Drizzle driver in storage.ts.
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ─── Schools ──────────────────────────────────────────
export const schools = sqliteTable("schools", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  address: text("address"),
  state: text("state"),
  lga: text("lga"),
  type: text("type").notNull().default("secondary"),
  studentCount: integer("student_count").default(0),
  ndpcRegNumber: text("ndpc_reg_number"),
  createdAt: text("created_at").notNull().default("now()"),
});

// ─── Users ────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("staff"),
  department: text("department"),
  createdAt: text("created_at").notNull().default("now()"),
});

// ─── Compliance Items ─────────────────────────────────
export const complianceItems = sqliteTable("compliance_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id").notNull(),
  itemKey: text("item_key").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("not_started"),
  weight: integer("weight").default(5),
  dueDate: text("due_date"),
  updatedAt: text("updated_at"),
});

// ─── Threats ──────────────────────────────────────────
export const threats = sqliteTable("threats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("medium"),
  type: text("type").notNull().default("malware"),
  publishedAt: text("published_at").notNull(),
  country: text("country"),
  isEducationSector: integer("is_education_sector").default(0),
  iocData: text("ioc_data"),
});

// ─── Incidents ────────────────────────────────────────
export const incidents = sqliteTable("incidents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id").notNull(),
  reportedBy: text("reported_by").notNull(),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("open"),
  step: integer("step").default(1),
  description: text("description").notNull(),
  affectedSystems: text("affected_systems"),
  affectedCount: integer("affected_count").default(0),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

// ─── Incident Actions ─────────────────────────────────
export const incidentActions = sqliteTable("incident_actions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  incidentId: integer("incident_id").notNull(),
  action: text("action").notNull(),
  performedBy: text("performed_by").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// ─── Training Courses ─────────────────────────────────
export const trainingCourses = sqliteTable("training_courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  durationMin: integer("duration_min").default(30),
  icon: text("icon"),
  contentMd: text("content_md"),
  quizJson: text("quiz_json"),
  passMark: integer("pass_mark").default(70),
});

// ─── Training Progress ────────────────────────────────
export const trainingProgress = sqliteTable("training_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  courseId: integer("course_id").notNull(),
  status: text("status").notNull().default("not_started"),
  score: integer("score"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
});

// ─── News Articles ────────────────────────────────────
export const newsArticles = sqliteTable("news_articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  source: text("source").notNull(),
  url: text("url"),
  summary: text("summary"),
  publishedAt: text("published_at").notNull(),
  keywords: text("keywords"),
});

// ─── Audit Log ────────────────────────────────────────
export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id"),
  userId: integer("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  details: text("details"),
  timestamp: text("timestamp").notNull(),
});

// ─── Compliance Evidence ──────────────────────────────
export const complianceEvidence = sqliteTable("compliance_evidence", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  complianceItemId: integer("compliance_item_id").notNull(),
  schoolId: integer("school_id").notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  uploadedBy: integer("uploaded_by").notNull(),
  createdAt: text("created_at").notNull(),
});

// ─── Sessions ─────────────────────────────────────────
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

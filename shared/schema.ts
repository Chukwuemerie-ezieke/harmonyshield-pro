import { pgTable, text, integer, serial, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Schools ──────────────────────────────────────────
export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  state: text("state"),
  lga: text("lga"),
  type: text("type").notNull().default("secondary"),
  studentCount: integer("student_count").default(0),
  ndpcRegNumber: text("ndpc_reg_number"),
  createdAt: text("created_at").notNull().default("now()"),
});
export const insertSchoolSchema = createInsertSchema(schools).omit({ id: true });
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schools.$inferSelect;

// ─── Users ────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("staff"), // admin, dpo, staff, teacher
  department: text("department"),
  createdAt: text("created_at").notNull().default("now()"),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Compliance Items ─────────────────────────────────
export const complianceItems = pgTable("compliance_items", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  itemKey: text("item_key").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("not_started"),
  weight: integer("weight").default(5),
  dueDate: text("due_date"),
  updatedAt: text("updated_at"),
});
export const insertComplianceItemSchema = createInsertSchema(complianceItems).omit({ id: true });
export type InsertComplianceItem = z.infer<typeof insertComplianceItemSchema>;
export type ComplianceItem = typeof complianceItems.$inferSelect;

// ─── Threats ──────────────────────────────────────────
export const threats = pgTable("threats", {
  id: serial("id").primaryKey(),
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
export const insertThreatSchema = createInsertSchema(threats).omit({ id: true });
export type InsertThreat = z.infer<typeof insertThreatSchema>;
export type Threat = typeof threats.$inferSelect;

// ─── Incidents ────────────────────────────────────────
export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
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
export const insertIncidentSchema = createInsertSchema(incidents).omit({ id: true });
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;

// ─── Incident Actions ─────────────────────────────────
export const incidentActions = pgTable("incident_actions", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id").notNull(),
  action: text("action").notNull(),
  performedBy: text("performed_by").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertIncidentActionSchema = createInsertSchema(incidentActions).omit({ id: true });
export type InsertIncidentAction = z.infer<typeof insertIncidentActionSchema>;
export type IncidentAction = typeof incidentActions.$inferSelect;

// ─── Training Courses ─────────────────────────────────
export const trainingCourses = pgTable("training_courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  durationMin: integer("duration_min").default(30),
  icon: text("icon"),
  contentMd: text("content_md"),
  quizJson: text("quiz_json"),
  passMark: integer("pass_mark").default(70),
});
export type TrainingCourse = typeof trainingCourses.$inferSelect;

// ─── Training Progress ────────────────────────────────
export const trainingProgress = pgTable("training_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  courseId: integer("course_id").notNull(),
  status: text("status").notNull().default("not_started"),
  score: integer("score"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
});
export type TrainingProgress = typeof trainingProgress.$inferSelect;

// ─── News Articles ────────────────────────────────────
export const newsArticles = pgTable("news_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  source: text("source").notNull(),
  url: text("url"),
  summary: text("summary"),
  publishedAt: text("published_at").notNull(),
  keywords: text("keywords"),
});
export type NewsArticle = typeof newsArticles.$inferSelect;

// ─── Audit Log ────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id"),
  userId: integer("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  details: text("details"),
  timestamp: text("timestamp").notNull(),
});
export type AuditLogEntry = typeof auditLog.$inferSelect;

// ─── Sessions ─────────────────────────────────────────
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});
export type Session = typeof sessions.$inferSelect;

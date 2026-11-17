import { pgTable, text, integer, serial, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod";

// Timestamps are stored as ISO-8601 strings (text) to keep the API payloads
// identical to what the client already expects.

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
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: text("created_at").notNull(),
});
export type School = typeof schools.$inferSelect;

// ─── Users ────────────────────────────────────────────
export const ROLES = ["admin", "dpo", "teacher", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    password: text("password").notNull(),
    role: text("role").notNull().default("staff"),
    department: text("department"),
    isActive: boolean("is_active").notNull().default(true),
    // Bumped on password change / deactivation to invalidate existing tokens.
    tokenVersion: integer("token_version").notNull().default(0),
    lastLoginAt: text("last_login_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), index("users_school_idx").on(t.schoolId)],
);
export type User = typeof users.$inferSelect;
export type PublicUser = Omit<User, "password" | "tokenVersion">;

// ─── Compliance Items ─────────────────────────────────
export const complianceItems = pgTable(
  "compliance_items",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("not_started"),
    weight: integer("weight").default(5),
    dueDate: text("due_date"),
    updatedAt: text("updated_at"),
  },
  (t) => [uniqueIndex("compliance_school_key_idx").on(t.schoolId, t.itemKey)],
);
export type ComplianceItem = typeof complianceItems.$inferSelect;

// ─── Threats (sample data, shown in demo only) ────────
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
export type Threat = typeof threats.$inferSelect;

// ─── Incidents ────────────────────────────────────────
export const incidents = pgTable(
  "incidents",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
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
  },
  (t) => [index("incidents_school_idx").on(t.schoolId)],
);
export type Incident = typeof incidents.$inferSelect;

// ─── Incident Actions ─────────────────────────────────
export const incidentActions = pgTable(
  "incident_actions",
  {
    id: serial("id").primaryKey(),
    incidentId: integer("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    performedBy: text("performed_by").notNull(),
    status: text("status").notNull().default("pending"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("incident_actions_incident_idx").on(t.incidentId)],
);
export type IncidentAction = typeof incidentActions.$inferSelect;

// ─── Training Courses (global content) ────────────────
export const trainingCourses = pgTable("training_courses", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
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
export const trainingProgress = pgTable(
  "training_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: integer("course_id").notNull().references(() => trainingCourses.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("not_started"),
    score: integer("score"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
  },
  (t) => [uniqueIndex("training_progress_user_course_idx").on(t.userId, t.courseId)],
);
export type TrainingProgress = typeof trainingProgress.$inferSelect;

// ─── News Articles (sample data, shown in demo only) ──
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
export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id"),
    userId: integer("user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: integer("entity_id"),
    details: text("details"),
    timestamp: text("timestamp").notNull(),
  },
  (t) => [index("audit_school_ts_idx").on(t.schoolId, t.timestamp)],
);
export type AuditLogEntry = typeof auditLog.$inferSelect;

// ─── Live feed cache (filled by the cron trigger) ─────
export const feedCache = pgTable("feed_cache", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── API input validation ─────────────────────────────
const shortText = (max = 200) => z.string().trim().max(max);

export const COMPLIANCE_STATUSES = ["not_started", "non_compliant", "partial", "compliant"] as const;
export const INCIDENT_TYPES = [
  "phishing", "malware", "ransomware", "data_breach", "unauthorized_access", "ddos", "insider_threat", "other",
] as const;
export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const INCIDENT_STATUSES = [
  "open", "investigating", "contained", "eradicated", "recovered", "resolved", "closed",
] as const;
export const ACTION_STATUSES = ["pending", "in_progress", "completed"] as const;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200);

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export const createUserSchema = z.object({
  name: shortText(120).min(2),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(ROLES),
  department: shortText(120).optional().nullable(),
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  role: z.enum(ROLES).optional(),
  department: shortText(120).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateComplianceSchema = z.object({
  status: z.enum(COMPLIANCE_STATUSES).optional(),
  dueDate: z.string().date().optional().nullable(),
});

export const createIncidentSchema = z.object({
  type: z.enum(INCIDENT_TYPES),
  severity: z.enum(SEVERITIES),
  description: shortText(5000).min(5),
  affectedSystems: shortText(500).optional().nullable(),
  affectedCount: z.coerce.number().int().min(0).max(10_000_000).optional(),
});

export const updateIncidentSchema = z.object({
  status: z.enum(INCIDENT_STATUSES).optional(),
  step: z.coerce.number().int().min(1).max(6).optional(),
  severity: z.enum(SEVERITIES).optional(),
  description: shortText(5000).min(5).optional(),
  affectedSystems: shortText(500).optional().nullable(),
  affectedCount: z.coerce.number().int().min(0).max(10_000_000).optional(),
});

export const createIncidentActionSchema = z.object({
  action: shortText(500).min(2),
  status: z.enum(ACTION_STATUSES).optional(),
  notes: shortText(5000).optional().nullable(),
});

export const updateIncidentActionSchema = z.object({
  status: z.enum(ACTION_STATUSES).optional(),
  notes: shortText(5000).optional().nullable(),
});

export const trainingProgressSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  status: z.literal("in_progress"),
});

export const quizSubmissionSchema = z.object({
  answers: z.array(z.number().int().min(0).max(20).nullable()).max(100),
});

export const updateSettingsSchema = z.object({
  name: shortText(200).min(2).optional(),
  address: shortText(500).optional().nullable(),
  state: shortText(100).optional().nullable(),
  lga: shortText(100).optional().nullable(),
  type: z.enum(["primary", "secondary", "tertiary", "vocational", "other"]).optional(),
  studentCount: z.coerce.number().int().min(0).max(1_000_000).optional(),
  ndpcRegNumber: shortText(100).optional().nullable(),
});

export const ipSchema = z.string().ip();

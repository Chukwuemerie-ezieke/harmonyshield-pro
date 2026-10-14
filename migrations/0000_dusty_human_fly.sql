CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer,
	"user_id" integer,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" integer,
	"details" text,
	"timestamp" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"item_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'not_started' NOT NULL,
	"weight" integer DEFAULT 5,
	"due_date" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "incident_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" integer NOT NULL,
	"action" text NOT NULL,
	"performed_by" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"reported_by" text NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"step" integer DEFAULT 1,
	"description" text NOT NULL,
	"affected_systems" text,
	"affected_count" integer DEFAULT 0,
	"created_at" text NOT NULL,
	"resolved_at" text
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"source" text NOT NULL,
	"url" text,
	"summary" text,
	"published_at" text NOT NULL,
	"keywords" text
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"state" text,
	"lga" text,
	"type" text DEFAULT 'secondary' NOT NULL,
	"student_count" integer DEFAULT 0,
	"ndpc_reg_number" text,
	"created_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "threats" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" text DEFAULT 'medium' NOT NULL,
	"type" text DEFAULT 'malware' NOT NULL,
	"published_at" text NOT NULL,
	"country" text,
	"is_education_sector" integer DEFAULT 0,
	"ioc_data" text
);
--> statement-breakpoint
CREATE TABLE "training_courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"duration_min" integer DEFAULT 30,
	"icon" text,
	"content_md" text,
	"quiz_json" text,
	"pass_mark" integer DEFAULT 70
);
--> statement-breakpoint
CREATE TABLE "training_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"score" integer,
	"started_at" text,
	"completed_at" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"department" text,
	"created_at" text DEFAULT 'now()' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

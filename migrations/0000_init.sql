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
CREATE TABLE "feed_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" text NOT NULL
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
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
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
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"duration_min" integer DEFAULT 30,
	"icon" text,
	"content_md" text,
	"quiz_json" text,
	"pass_mark" integer DEFAULT 70,
	CONSTRAINT "training_courses_slug_unique" UNIQUE("slug")
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
	"is_active" boolean DEFAULT true NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"last_login_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_items" ADD CONSTRAINT "compliance_items_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_actions" ADD CONSTRAINT "incident_actions_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_progress" ADD CONSTRAINT "training_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_progress" ADD CONSTRAINT "training_progress_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_school_ts_idx" ON "audit_log" USING btree ("school_id","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_school_key_idx" ON "compliance_items" USING btree ("school_id","item_key");--> statement-breakpoint
CREATE INDEX "incident_actions_incident_idx" ON "incident_actions" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incidents_school_idx" ON "incidents" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_progress_user_course_idx" ON "training_progress" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_school_idx" ON "users" USING btree ("school_id");
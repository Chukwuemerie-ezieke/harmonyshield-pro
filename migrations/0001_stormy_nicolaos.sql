CREATE TABLE "compliance_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"compliance_item_id" integer NOT NULL,
	"school_id" integer NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by" integer NOT NULL,
	"created_at" text NOT NULL
);

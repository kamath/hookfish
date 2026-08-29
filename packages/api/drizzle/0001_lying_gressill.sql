CREATE TABLE "registry_entry" (
	"url" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"document" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

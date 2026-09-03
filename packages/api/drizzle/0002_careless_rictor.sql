CREATE TABLE "cached_source" (
	"source_id" text PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"created_by_user_id" text,
	"kind" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cached_source" ADD CONSTRAINT "cached_source_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cached_source_kind_source_url_uidx" ON "cached_source" USING btree ("kind","source_url");--> statement-breakpoint
CREATE INDEX "cached_source_created_by_user_id_idx" ON "cached_source" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "cached_source_updated_at_idx" ON "cached_source" USING btree ("updated_at");
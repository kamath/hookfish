ALTER TABLE "cached_source" RENAME COLUMN "user_id" TO "created_by_user_id";--> statement-breakpoint
ALTER TABLE "cached_source" DROP CONSTRAINT "cached_source_user_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "cached_source_user_id_updated_at_idx";--> statement-breakpoint
ALTER TABLE "cached_source" DROP CONSTRAINT "cached_source_user_id_source_id_pk";--> statement-breakpoint
ALTER TABLE "cached_source" ADD PRIMARY KEY ("source_id");--> statement-breakpoint
ALTER TABLE "cached_source" ALTER COLUMN "created_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cached_source" ADD CONSTRAINT "cached_source_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cached_source_created_by_user_id_idx" ON "cached_source" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "cached_source_updated_at_idx" ON "cached_source" USING btree ("updated_at");
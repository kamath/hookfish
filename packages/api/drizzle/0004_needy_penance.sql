ALTER TABLE "cached_source" ADD COLUMN "source_url" text;--> statement-breakpoint
DELETE FROM "cached_source";--> statement-breakpoint
ALTER TABLE "cached_source" ALTER COLUMN "source_url" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cached_source_kind_source_url_uidx" ON "cached_source" USING btree ("kind","source_url");
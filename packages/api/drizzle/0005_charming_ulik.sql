CREATE TABLE "registry" (
	"row_id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "registry_type_check" CHECK ("registry"."type" IN ('MCP', 'API'))
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"registry_row_id" integer NOT NULL,
	"tag" text NOT NULL,
	CONSTRAINT "tags_registry_row_id_tag_pk" PRIMARY KEY("registry_row_id","tag")
);
--> statement-breakpoint
INSERT INTO "registry" ("url", "title", "type")
SELECT "url", "title", "type"
FROM "suggested_source";--> statement-breakpoint
INSERT INTO "tags" ("registry_row_id", "tag")
SELECT
	"registry"."row_id",
	CASE
		WHEN "suggested_source"."type" = 'MCP' THEN 'trending_mcp'
		ELSE 'trending_api'
	END
FROM "suggested_source"
INNER JOIN "registry" ON "registry"."url" = "suggested_source"."url";--> statement-breakpoint
DROP TABLE "suggested_source" CASCADE;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_registry_row_id_registry_row_id_fk" FOREIGN KEY ("registry_row_id") REFERENCES "public"."registry"("row_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "registry_url_uidx" ON "registry" USING btree ("url");
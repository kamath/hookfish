ALTER TABLE "suggested_source" ADD COLUMN "type" text;--> statement-breakpoint
UPDATE "suggested_source"
SET "type" = CASE
	WHEN "category_name" = 'MCP Servers' THEN 'MCP'
	ELSE 'API'
END;--> statement-breakpoint
ALTER TABLE "suggested_source" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "suggested_source" ADD CONSTRAINT "suggested_source_type_check" CHECK ("suggested_source"."type" IN ('MCP', 'API'));
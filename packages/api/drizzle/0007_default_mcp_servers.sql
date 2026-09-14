DELETE FROM "registry"
WHERE "url" IN (
	'https://omni.arcade.dev/mcp',
	'https://api.bosslevel.dev/mcp/gw_3F3PbNNz9DdEJ6zdHqbegVC7mMo'
);
--> statement-breakpoint
UPDATE "registry"
SET "title" = 'Arcade Gmail'
WHERE "url" = 'https://server.smithery.ai/gmail';
--> statement-breakpoint
INSERT INTO "registry" ("url", "title", "type") VALUES
	('https://server.smithery.ai/googlecalendar', 'Arcade Google Calendar', 'MCP'),
	('https://server.smithery.ai/slack', 'Arcade Slack', 'MCP')
ON CONFLICT ("url") DO UPDATE SET "title" = EXCLUDED."title", "type" = EXCLUDED."type";
--> statement-breakpoint
INSERT INTO "tags" ("registry_row_id", "tag")
SELECT "registry"."row_id", 'trending_mcp'
FROM "registry"
WHERE "registry"."url" IN (
	'https://server.smithery.ai/googlecalendar',
	'https://server.smithery.ai/slack'
)
ON CONFLICT ("registry_row_id", "tag") DO NOTHING;

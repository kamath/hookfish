-- The feed orders each category by "row_id", so this rewrites every seeded row to
-- set both the default set and the order it renders in. MCP servers alternate
-- between Arcade-hosted and first-party; the API order is unchanged.
DELETE FROM "registry"
WHERE "url" IN (
	'https://omni.arcade.dev/mcp',
	'https://api.bosslevel.dev/mcp/gw_3F3PbNNz9DdEJ6zdHqbegVC7mMo',
	'https://server.smithery.ai/gmail',
	'https://server.smithery.ai/googlecalendar',
	'https://server.smithery.ai/slack',
	'https://mcp.linear.app/mcp',
	'https://mcp.notion.com/mcp',
	'https://raw.githubusercontent.com/api-evangelist/anthropic/refs/heads/main/openapi/anthropic-messages-api-openapi.yml',
	'https://api.arcade.dev/v1/swagger',
	'/api/openapi.json',
	'https://raw.githubusercontent.com/openai/openai-openapi/refs/heads/main/openapi.json',
	'https://petstore3.swagger.io/api/v3/openapi.json'
);--> statement-breakpoint
INSERT INTO "registry" ("url", "title", "type") VALUES
	('https://server.smithery.ai/gmail', 'Gmail (Arcade)', 'MCP'),
	('https://mcp.linear.app/mcp', 'Linear', 'MCP'),
	('https://server.smithery.ai/googlecalendar', 'Google Calendar (Arcade)', 'MCP'),
	('https://mcp.notion.com/mcp', 'Notion', 'MCP'),
	('https://server.smithery.ai/slack', 'Slack (Arcade)', 'MCP'),
	('https://raw.githubusercontent.com/api-evangelist/anthropic/refs/heads/main/openapi/anthropic-messages-api-openapi.yml', 'Anthropic', 'API'),
	('https://api.arcade.dev/v1/swagger', 'Arcade API', 'API'),
	('/api/openapi.json', 'Hookfish API', 'API'),
	('https://raw.githubusercontent.com/openai/openai-openapi/refs/heads/main/openapi.json', 'OpenAI', 'API'),
	('https://petstore3.swagger.io/api/v3/openapi.json', 'Swagger Petstore', 'API');--> statement-breakpoint
INSERT INTO "tags" ("registry_row_id", "tag")
SELECT
	"registry"."row_id",
	CASE WHEN "registry"."type" = 'MCP' THEN 'trending_mcp' ELSE 'trending_api' END
FROM "registry"
WHERE "registry"."url" IN (
	'https://server.smithery.ai/gmail',
	'https://mcp.linear.app/mcp',
	'https://server.smithery.ai/googlecalendar',
	'https://mcp.notion.com/mcp',
	'https://server.smithery.ai/slack',
	'https://raw.githubusercontent.com/api-evangelist/anthropic/refs/heads/main/openapi/anthropic-messages-api-openapi.yml',
	'https://api.arcade.dev/v1/swagger',
	'/api/openapi.json',
	'https://raw.githubusercontent.com/openai/openai-openapi/refs/heads/main/openapi.json',
	'https://petstore3.swagger.io/api/v3/openapi.json'
)
ON CONFLICT ("registry_row_id", "tag") DO NOTHING;

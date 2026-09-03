CREATE TABLE "suggested_source" (
	"url" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category_name" text NOT NULL
);
--> statement-breakpoint
DROP TABLE "account" CASCADE;--> statement-breakpoint
DROP TABLE "api_key" CASCADE;--> statement-breakpoint
DROP TABLE "cached_source" CASCADE;--> statement-breakpoint
DROP TABLE "jwks" CASCADE;--> statement-breakpoint
DROP TABLE "session" CASCADE;--> statement-breakpoint
DROP TABLE "user" CASCADE;--> statement-breakpoint
DROP TABLE "verification" CASCADE;--> statement-breakpoint
INSERT INTO "suggested_source" ("url", "title", "category_name") VALUES
	('https://omni.arcade.dev/mcp', 'Arcade Omni', 'MCP Servers'),
	('https://api.bosslevel.dev/mcp/gw_3F3PbNNz9DdEJ6zdHqbegVC7mMo', 'Arcade Full Suite', 'MCP Servers'),
	('https://server.smithery.ai/gmail', 'Smithery Gmail', 'MCP Servers'),
	('https://mcp.linear.app/mcp', 'Linear', 'MCP Servers'),
	('https://mcp.notion.com/mcp', 'Notion', 'MCP Servers'),
	('https://api.arcade.dev/v1/swagger', 'Arcade API', 'OpenAPI'),
	('/api/openapi.json', 'Smithery API', 'OpenAPI'),
	('https://petstore3.swagger.io/api/v3/openapi.json', 'Swagger Petstore', 'OpenAPI'),
	('https://raw.githubusercontent.com/openai/openai-openapi/refs/heads/main/openapi.json', 'OpenAI', 'OpenAPI'),
	('https://raw.githubusercontent.com/api-evangelist/anthropic/refs/heads/main/openapi/anthropic-messages-api-openapi.yml', 'Anthropic', 'OpenAPI');
UPDATE "registry"
SET "title" = 'Hookfish Gmail'
WHERE "url" = 'https://server.smithery.ai/gmail'
	AND "title" = 'Smithery Gmail';
--> statement-breakpoint
UPDATE "registry"
SET "title" = 'Hookfish API'
WHERE "url" = '/api/openapi.json'
	AND "title" = 'Smithery API';

CREATE TABLE "cached_source" (
	"source_id" text NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cached_source_user_id_source_id_pk" PRIMARY KEY("user_id","source_id")
);
--> statement-breakpoint
ALTER TABLE "cached_source" ADD CONSTRAINT "cached_source_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cached_source_user_id_updated_at_idx" ON "cached_source" USING btree ("user_id","updated_at");
import { sql } from 'drizzle-orm'
import { check, pgTable, text } from 'drizzle-orm/pg-core'

export const suggestedSource = pgTable(
  'suggested_source',
  {
    url: text('url').primaryKey(),
    title: text('title').notNull(),
    categoryName: text('category_name').notNull(),
    type: text('type', { enum: ['MCP', 'API'] }).notNull(),
  },
  (table) => [
    check('suggested_source_type_check', sql`${table.type} IN ('MCP', 'API')`),
  ],
)

export const schema = {
  suggestedSource,
}

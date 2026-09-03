import { pgTable, text } from 'drizzle-orm/pg-core'

export const suggestedSource = pgTable('suggested_source', {
  url: text('url').primaryKey(),
  title: text('title').notNull(),
  categoryName: text('category_name').notNull(),
})

export const schema = {
  suggestedSource,
}

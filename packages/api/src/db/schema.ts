import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const registry = pgTable(
  'registry',
  {
    rowId: serial('row_id').primaryKey(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    type: text('type', { enum: ['MCP', 'API'] }).notNull(),
  },
  (table) => [
    uniqueIndex('registry_url_uidx').on(table.url),
    check('registry_type_check', sql`${table.type} IN ('MCP', 'API')`),
  ],
)

export const tags = pgTable(
  'tags',
  {
    registryRowId: integer('registry_row_id')
      .notNull()
      .references(() => registry.rowId, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.registryRowId, table.tag],
      name: 'tags_registry_row_id_tag_pk',
    }),
  ],
)

export const schema = {
  registry,
  tags,
}

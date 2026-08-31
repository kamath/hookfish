import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

const timestampColumn = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' })

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestampColumn('created_at').defaultNow().notNull(),
  updatedAt: timestampColumn('updated_at').defaultNow().notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestampColumn('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestampColumn('created_at').defaultNow().notNull(),
  updatedAt: timestampColumn('updated_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    issuer: text('issuer').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestampColumn('access_token_expires_at'),
    refreshTokenExpiresAt: timestampColumn('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestampColumn('created_at').defaultNow().notNull(),
    updatedAt: timestampColumn('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('account_issuer_accountId_uidx').on(table.issuer, table.accountId),
  ],
)

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestampColumn('expires_at').notNull(),
  createdAt: timestampColumn('created_at').defaultNow().notNull(),
  updatedAt: timestampColumn('updated_at').defaultNow().notNull(),
})

export const apiKey = pgTable(
  'api_key',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    expiresAt: timestampColumn('expires_at'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestampColumn('created_at').defaultNow().notNull(),
  },
  (table) => [index('api_key_user_id_idx').on(table.userId)],
)

export const cachedSource = pgTable(
  'cached_source',
  {
    sourceId: text('source_id').primaryKey(),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    kind: text('kind').notNull(),
    metadata: jsonb('metadata').notNull(),
    createdAt: timestampColumn('created_at').defaultNow().notNull(),
    updatedAt: timestampColumn('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('cached_source_created_by_user_id_idx').on(table.createdByUserId),
    index('cached_source_updated_at_idx').on(table.updatedAt),
  ],
)

export const jwks = pgTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: timestampColumn('created_at').notNull(),
  expiresAt: timestampColumn('expires_at'),
  alg: text('alg'),
  crv: text('crv'),
})

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  apiKeys: many(apiKey),
  cachedSources: many(cachedSource),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
  user: one(user, {
    fields: [apiKey.userId],
    references: [user.id],
  }),
}))

export const cachedSourceRelations = relations(cachedSource, ({ one }) => ({
  createdBy: one(user, {
    fields: [cachedSource.createdByUserId],
    references: [user.id],
  }),
}))

export const schema = {
  user,
  session,
  account,
  verification,
  apiKey,
  cachedSource,
  jwks,
  userRelations,
  sessionRelations,
  accountRelations,
  apiKeyRelations,
  cachedSourceRelations,
}

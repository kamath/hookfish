import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { z } from 'zod'
import type { ApiSummary, ClientApi } from './client-types'
import { getDb } from './db.server'
import { apiAuthStored, clearApiAuth } from './auth.functions'
import { fetchSpec, specToClient } from './openapi.server'
import { ensureUser } from './session.functions'

type ApiRow = {
  id: string
  title: string
  version: string | null
  spec_url: string
  spec_json: string
  operation_count: number
  created_at: string
}

export const listApis = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ApiSummary[]> => {
    const username = await ensureUser()
    const db = await getDb()
    const result = await db
      .prepare(
        `SELECT id, title, version, spec_url, operation_count, created_at
         FROM apis
         WHERE username = ?
         ORDER BY created_at DESC`,
      )
      .bind(username)
      .all<Omit<ApiRow, 'spec_json'>>()

    return (result.results ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      version: row.version ?? undefined,
      specUrl: row.spec_url,
      operationCount: row.operation_count,
      createdAt: row.created_at,
    }))
  },
)

export const addApi = createServerFn({ method: 'POST' })
  .validator(z.object({ url: z.string().trim().min(1) }))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const username = await ensureUser()
    const spec = await fetchSpec(data.url)
    const id = crypto.randomUUID()
    const client = specToClient(spec, data.url, id)
    const db = await getDb()

    await db
      .prepare(
        `INSERT INTO apis (id, username, title, version, spec_url, spec_json, operation_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        username,
        client.title,
        client.version ?? null,
        data.url,
        JSON.stringify(spec),
        client.operations.length,
      )
      .run()

    return { id }
  })

export const getApi = createServerFn({
  method: 'GET',
  strict: { output: false },
})
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }): Promise<ClientApi> => {
    const username = await ensureUser()
    const db = await getDb()
    const row = await db
      .prepare(
        `SELECT id, title, version, spec_url, spec_json, operation_count, created_at
         FROM apis
         WHERE id = ? AND username = ?`,
      )
      .bind(data.id, username)
      .first<ApiRow>()

    if (!row) {
      throw notFound()
    }

    return {
      ...specToClient(JSON.parse(row.spec_json), row.spec_url, row.id),
      authStored: await apiAuthStored(row.id),
    }
  })

export const removeApi = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const username = await ensureUser()
    const db = await getDb()
    await db
      .prepare('DELETE FROM apis WHERE id = ? AND username = ?')
      .bind(data.id, username)
      .run()
    await clearApiAuth(data.id)
    return { ok: true }
  })

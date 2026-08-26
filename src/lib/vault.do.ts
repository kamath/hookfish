import { DurableObject } from 'cloudflare:workers'

const LOCAL_WRAP = 'oc-local-wrap'

type SecretRow = {
  field: string
  nonce: string
  ciphertext: string
}

function bytesToB64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function b64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function wrapKey(secret: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret),
  )
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

export class UserVault extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS secrets (
          api_id TEXT NOT NULL,
          field TEXT NOT NULL,
          nonce TEXT NOT NULL,
          ciphertext TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (api_id, field)
        )
      `)
    })
  }

  async put(apiId: string, fields: Record<string, string>) {
    const key = await this.#key()
    for (const [field, raw] of Object.entries(fields)) {
      const value = raw.trim()
      if (!value) {
        continue
      }
      const nonce = crypto.getRandomValues(new Uint8Array(12))
      const sealed = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        key,
        new TextEncoder().encode(value),
      )
      this.ctx.storage.sql.exec(
        `INSERT INTO secrets (api_id, field, nonce, ciphertext)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(api_id, field) DO UPDATE SET
           nonce = excluded.nonce,
           ciphertext = excluded.ciphertext,
           updated_at = datetime('now')`,
        apiId,
        field,
        bytesToB64(nonce),
        bytesToB64(new Uint8Array(sealed)),
      )
    }
  }

  async get(apiId: string): Promise<Record<string, string>> {
    const key = await this.#key()
    const rows = this.ctx.storage.sql
      .exec<SecretRow>(
        'SELECT field, nonce, ciphertext FROM secrets WHERE api_id = ?',
        apiId,
      )
      .toArray()

    const fields: Record<string, string> = {}
    for (const row of rows) {
      const opened = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBytes(row.nonce) },
        key,
        b64ToBytes(row.ciphertext),
      )
      fields[row.field] = new TextDecoder().decode(opened)
    }
    return fields
  }

  async has(apiId: string): Promise<boolean> {
    const row = this.ctx.storage.sql
      .exec<{ count: number }>(
        'SELECT COUNT(*) as count FROM secrets WHERE api_id = ?',
        apiId,
      )
      .one()
    return row.count > 0
  }

  async clear(apiId: string) {
    this.ctx.storage.sql.exec('DELETE FROM secrets WHERE api_id = ?', apiId)
  }

  async #key() {
    return wrapKey(this.env.AUTH_WRAP_KEY || LOCAL_WRAP)
  }
}

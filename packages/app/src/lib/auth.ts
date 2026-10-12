import { asRecord } from './build-request'
import {
  clearAuth,
  clearHeaders,
  readAuth,
  readHeaders,
  writeAuth,
  writeHeaders,
} from './storage'

export function saveApiAuth(apiId: string, fields: Record<string, string>) {
  const next = { ...readAuth(apiId) }
  for (const [name, value] of Object.entries(fields)) {
    if (value.trim()) {
      next[name] = value.trim()
    }
  }
  writeAuth(apiId, next)
}

export function readApiAuth(apiId: string): Record<string, string> {
  return readAuth(apiId)
}

export function apiAuthStored(apiId: string): boolean {
  return Object.keys(readAuth(apiId)).length > 0
}

// Custom headers are credentials too, so clearing auth clears them.
export function clearApiAuth(apiId: string) {
  clearAuth(apiId)
  clearHeaders(apiId)
}

export function saveApiHeaders(apiId: string, headers: Record<string, string>) {
  writeHeaders(apiId, headers)
}

export function readApiHeaders(apiId: string): Record<string, string> {
  return readHeaders(apiId)
}

export function apiHeadersStored(apiId: string): boolean {
  return Object.keys(readHeaders(apiId)).length > 0
}

export function fieldsFromForm(value: unknown): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const [name, item] of Object.entries(asRecord(value))) {
    if (typeof item === 'string') {
      fields[name] = item
    }
  }
  return fields
}

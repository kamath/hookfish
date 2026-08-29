import { apiJson, getApi } from './api'
import type {
  AuthSession,
  CreateApiKeyRequest,
  SignInRequest,
  SignUpRequest,
} from '@hookfish/api'

export type CreatedApiKey = {
  name: string
  expiresAt: string | null
  key: string
}

export async function fetchSession() {
  return apiJson<AuthSession>(await getApi().auth.session.$get())
}

export async function signIn(body: SignInRequest) {
  return apiJson<AuthSession>(await getApi().auth['sign-in'].$post({ json: body }))
}

export async function signUp(body: SignUpRequest) {
  return apiJson<AuthSession>(await getApi().auth['sign-up'].$post({ json: body }))
}

export async function signOut() {
  return apiJson<{ ok: true }>(await getApi().auth['sign-out'].$post())
}

export async function createApiKey(body: CreateApiKeyRequest) {
  const result = await apiJson<{ apiKey: CreatedApiKey }>(
    await getApi().auth['api-keys'].$post({ json: body }),
  )
  return result.apiKey
}

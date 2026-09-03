import { apiJson, getApi } from './api'
import type { AuthSession, SignInRequest, SignUpRequest } from '@hookfish/api'

export async function fetchSession() {
  return apiJson<AuthSession>(await getApi().auth.session.$get())
}

export async function signIn(body: SignInRequest) {
  return apiJson<AuthSession>(await getApi().auth.login.$post({ json: body }))
}

export async function signUp(body: SignUpRequest) {
  return apiJson<AuthSession>(await getApi().auth['sign-up'].$post({ json: body }))
}

export async function signOut() {
  return apiJson<{ ok: true }>(await getApi().auth['sign-out'].$post())
}

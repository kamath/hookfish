import { mcpOAuthClientMetadata } from '@hookfish/api'
import type {
  OAuthClientInformationContext,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthDiscoveryState,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from '@modelcontextprotocol/client'
import { atom } from 'jotai'
import { getApi } from '../api'
import { store } from '../chrome'

type OAuthStore = {
  clients?: Record<string, StoredOAuthClientInformation>
  tokens?: Record<string, StoredOAuthTokens>
  latestClientIssuer?: string
  latestTokenIssuer?: string
  codeVerifier?: string
  state?: string
  discovery?: OAuthDiscoveryState
  resourceUrl?: string
}

const CALLBACK_PARAMETERS = [
  'code',
  'state',
  'iss',
  'error',
  'error_description',
  'error_uri',
  'session_state',
]

type PendingAuthorization = {
  sourceId: string
  url: string
}

let pendingAuthorization: PendingAuthorization | undefined

type TokenStore = Pick<OAuthStore, 'tokens' | 'latestTokenIssuer'>
type HandshakeStore = Omit<OAuthStore, keyof TokenStore>

// Access and refresh tokens are held only in memory, so a reload starts signed out. The
// handshake (state, PKCE verifier, client registration, discovery) has to survive the redirect
// to the authorization server, so it sits in this tab's sessionStorage instead. None of it
// grants access on its own, and the verifier and state are dropped once the callback lands.
const tokensAtom = atom<Record<string, TokenStore>>({})

function handshakeKey(sourceId: string) {
  return `oc:mcp-oauth-handshake:${sourceId}`
}

function sessionStore() {
  return typeof window === 'undefined' ? undefined : window.sessionStorage
}

function readHandshake(sourceId: string): HandshakeStore {
  const storage = sessionStore()
  const raw = storage?.getItem(handshakeKey(sourceId))
  if (!raw) {
    return {}
  }
  try {
    return JSON.parse(raw) as HandshakeStore
  } catch {
    storage?.removeItem(handshakeKey(sourceId))
    return {}
  }
}

function readStore(sourceId: string): OAuthStore {
  return { ...readHandshake(sourceId), ...store.get(tokensAtom)[sourceId] }
}

function writeStore(sourceId: string, value: OAuthStore) {
  const { tokens, latestTokenIssuer, ...handshake } = value
  const next = { ...store.get(tokensAtom) }
  if (tokens || latestTokenIssuer) {
    next[sourceId] = { tokens, latestTokenIssuer }
  } else {
    delete next[sourceId]
  }
  store.set(tokensAtom, next)

  const storage = sessionStore()
  if (Object.keys(handshake).length === 0) {
    storage?.removeItem(handshakeKey(sourceId))
  } else {
    storage?.setItem(handshakeKey(sourceId), JSON.stringify(handshake))
  }
}

function callbackUrl(sourceId: string, origin = window.location.origin) {
  return new URL(`/apis/${encodeURIComponent(sourceId)}/routes`, origin)
}

export class BrowserMcpOAuthProvider implements OAuthClientProvider {
  readonly clientMetadataUrl: string | undefined

  constructor(readonly sourceId: string) {
    const metadataUrl = getApi()['mcp-oauth-client'].$url({ query: { sourceId } })
    this.clientMetadataUrl =
      metadataUrl.protocol === 'https:' ? metadataUrl.toString() : undefined
  }

  get redirectUrl() {
    return callbackUrl(this.sourceId)
  }

  get clientMetadata(): OAuthClientMetadata {
    return mcpOAuthClientMetadata(this.sourceId, window.location.origin)
  }

  state() {
    const state = crypto.randomUUID()
    writeStore(this.sourceId, { ...readStore(this.sourceId), state })
    return state
  }

  clientInformation(ctx?: OAuthClientInformationContext) {
    const store = readStore(this.sourceId)
    const issuer = ctx?.issuer ?? store.latestClientIssuer
    return issuer ? store.clients?.[issuer] : undefined
  }

  saveClientInformation(
    information: StoredOAuthClientInformation,
    ctx?: OAuthClientInformationContext,
  ) {
    const issuer = ctx?.issuer ?? information.issuer
    if (!issuer) {
      return
    }
    const store = readStore(this.sourceId)
    writeStore(this.sourceId, {
      ...store,
      clients: { ...store.clients, [issuer]: information },
      latestClientIssuer: issuer,
    })
  }

  tokens(ctx?: OAuthClientInformationContext) {
    const store = readStore(this.sourceId)
    const issuer = ctx?.issuer ?? store.latestTokenIssuer
    return issuer ? store.tokens?.[issuer] : undefined
  }

  saveTokens(tokens: StoredOAuthTokens, ctx?: OAuthClientInformationContext) {
    const issuer = ctx?.issuer ?? tokens.issuer
    if (!issuer) {
      return
    }
    const store = readStore(this.sourceId)
    writeStore(this.sourceId, {
      ...store,
      tokens: { ...store.tokens, [issuer]: tokens },
      latestTokenIssuer: issuer,
    })
  }

  redirectToAuthorization(authorizationUrl: URL) {
    pendingAuthorization = {
      sourceId: this.sourceId,
      url: authorizationUrl.toString(),
    }
  }

  saveCodeVerifier(codeVerifier: string) {
    writeStore(this.sourceId, { ...readStore(this.sourceId), codeVerifier })
  }

  codeVerifier() {
    const verifier = readStore(this.sourceId).codeVerifier
    if (!verifier) {
      throw new Error('The MCP OAuth verifier is missing. Start authorization again.')
    }
    return verifier
  }

  saveDiscoveryState(discovery: OAuthDiscoveryState) {
    writeStore(this.sourceId, { ...readStore(this.sourceId), discovery })
  }

  discoveryState() {
    return readStore(this.sourceId).discovery
  }

  saveResourceUrl(resourceUrl: string) {
    writeStore(this.sourceId, { ...readStore(this.sourceId), resourceUrl })
  }

  resourceUrl() {
    return readStore(this.sourceId).resourceUrl
  }

  invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery') {
    const store = readStore(this.sourceId)
    if (scope === 'all') {
      clearMcpOAuth(this.sourceId)
      return
    }
    if (scope === 'client') {
      delete store.clients
      delete store.latestClientIssuer
    } else if (scope === 'tokens') {
      delete store.tokens
      delete store.latestTokenIssuer
    } else if (scope === 'verifier') {
      delete store.codeVerifier
      delete store.state
    } else {
      delete store.discovery
      delete store.resourceUrl
    }
    writeStore(this.sourceId, store)
  }

  callbackParameters() {
    const parameters = new URL(window.location.href).searchParams
    const hasCallback = parameters.has('code') || parameters.has('error')
    if (!hasCallback) {
      return undefined
    }

    const expectedState = readStore(this.sourceId).state
    if (!expectedState || parameters.get('state') !== expectedState) {
      this.finishCallback()
      this.cleanCallbackUrl()
      throw new Error('The MCP OAuth response could not be verified. Start authorization again.')
    }
    if (parameters.has('error')) {
      // Keep what the authorization server said. Without it every failure reads the same, and
      // the parameters are gone as soon as cleanCallbackUrl() runs.
      const code = parameters.get('error')?.trim()
      const description = parameters.get('error_description')?.trim()
      this.finishCallback()
      this.cleanCallbackUrl()
      const detail = [description, code && `(${code})`].filter(Boolean).join(' ')
      throw new Error(
        detail
          ? `MCP OAuth authorization was not completed: ${detail}`
          : 'MCP OAuth authorization was not completed.',
      )
    }
    return parameters
  }

  finishCallback() {
    pendingAuthorization = undefined
    const store = readStore(this.sourceId)
    delete store.codeVerifier
    delete store.state
    writeStore(this.sourceId, store)
  }

  cleanCallbackUrl() {
    const url = new URL(window.location.href)
    for (const parameter of CALLBACK_PARAMETERS) {
      url.searchParams.delete(parameter)
    }
    window.history.replaceState(window.history.state, '', url)
  }
}

export function clearMcpOAuth(sourceId: string) {
  writeStore(sourceId, {})
}

export function hasMcpOAuthTokens(sourceId: string) {
  return Boolean(readStore(sourceId).latestTokenIssuer)
}

export { mcpOAuthClientMetadata }

export function pendingMcpAuthorization() {
  return pendingAuthorization
}

export function pendingMcpAuthorizationUrl() {
  return pendingAuthorization?.url
}

export function clearPendingMcpAuthorization() {
  pendingAuthorization = undefined
}

export function isMcpOAuthCallback(href = window.location.href) {
  const parameters = new URL(href).searchParams
  return parameters.has('code') || parameters.has('error')
}

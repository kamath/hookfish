import type {
  OAuthClientInformationContext,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthDiscoveryState,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from '@modelcontextprotocol/client'

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

function storageKey(sourceId: string) {
  return `oc:mcp-oauth:${sourceId}`
}

function readStore(sourceId: string): OAuthStore {
  const raw = window.localStorage.getItem(storageKey(sourceId))
  if (!raw) {
    return {}
  }
  try {
    return JSON.parse(raw) as OAuthStore
  } catch {
    window.localStorage.removeItem(storageKey(sourceId))
    return {}
  }
}

function writeStore(sourceId: string, value: OAuthStore) {
  window.localStorage.setItem(storageKey(sourceId), JSON.stringify(value))
}

function callbackUrl(sourceId: string, origin = window.location.origin) {
  return new URL(`/apis/${encodeURIComponent(sourceId)}/routes`, origin)
}

function clientMetadata(sourceId: string, origin = window.location.origin): OAuthClientMetadata {
  return {
    client_name: 'Hookfish MCP Inspector',
    client_uri: origin,
    redirect_uris: [callbackUrl(sourceId, origin).toString()],
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'none',
  }
}

export class BrowserMcpOAuthProvider implements OAuthClientProvider {
  readonly clientMetadataUrl: string | undefined

  constructor(readonly sourceId: string) {
    const metadataUrl = new URL('/api/mcp-oauth-client', window.location.origin)
    metadataUrl.searchParams.set('sourceId', sourceId)
    this.clientMetadataUrl =
      metadataUrl.protocol === 'https:' ? metadataUrl.toString() : undefined
  }

  get redirectUrl() {
    return callbackUrl(this.sourceId)
  }

  get clientMetadata() {
    return clientMetadata(this.sourceId)
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
    window.location.assign(authorizationUrl)
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
      this.finishCallback()
      this.cleanCallbackUrl()
      throw new Error('MCP OAuth authorization was not completed.')
    }
    return parameters
  }

  finishCallback() {
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
  window.localStorage.removeItem(storageKey(sourceId))
}

export function hasMcpOAuthTokens(sourceId: string) {
  return Boolean(readStore(sourceId).latestTokenIssuer)
}

export function mcpOAuthClientMetadata(sourceId: string, origin: string) {
  return clientMetadata(sourceId, origin)
}

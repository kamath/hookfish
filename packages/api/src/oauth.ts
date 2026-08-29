export function mcpOAuthClientMetadata(sourceId: string, origin: string) {
  return {
    client_name: 'Smithery MCP Inspector',
    client_uri: origin,
    redirect_uris: [new URL(`/apis/${encodeURIComponent(sourceId)}/routes`, origin).toString()],
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'none',
  }
}

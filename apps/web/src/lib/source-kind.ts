export function neitherSourceError(errors: unknown[]) {
  const messages = errors
    .filter((error): error is Error => error instanceof Error)
    .map((error) => error.message)
  if (messages.some((message) => /CORS/i.test(message))) {
    return new Error('Likely CORS error. Cloud mode may help.')
  }
  if (
    messages.some((message) =>
      /(?:fetch the spec|fetch the source document).*\(401\)/i.test(message),
    )
  ) {
    return new Error(
      'This URL requires authentication, so its source type could not be detected.',
    )
  }
  return new Error('This URL is not an OpenAPI document or an MCP server.')
}

export async function probeSource<Document, Source>({
  readOpenApi,
  loadOpenApi,
  loadMcp,
  isMcpAuthorization,
}: {
  readOpenApi: () => Promise<Document | undefined>
  loadOpenApi: (document: Document) => Source
  loadMcp: () => Promise<Source>
  isMcpAuthorization: (error: unknown) => boolean
}): Promise<Source> {
  const errors: unknown[] = []
  let document: Document | undefined

  try {
    document = await readOpenApi()
  } catch (error) {
    errors.push(error)
  }
  if (document !== undefined) {
    // Once a document identifies itself as OpenAPI, surface parser errors
    // instead of retrying the same URL as an MCP endpoint.
    return loadOpenApi(document)
  }

  try {
    return await loadMcp()
  } catch (error) {
    if (isMcpAuthorization(error)) {
      throw error
    }
    errors.push(error)
  }

  throw neitherSourceError(errors)
}

import type {
  Prompt,
  Resource,
  ResourceTemplateType,
  Tool,
} from '@modelcontextprotocol/client'
import type {
  Executable,
  ExecutableSource,
  FormUiSchema,
  JsonSchema,
  McpBinding,
} from '../client-types'
import { getMcpConnection } from './client'

export type McpAdapterData = {
  era: 'modern' | 'legacy'
  protocolVersion: string
  capabilities: Record<string, unknown>
  serverInfo?: {
    name: string
    version: string
  }
  instructions?: string
}

const FORM_UI: FormUiSchema = {
  'ui:submitButtonOptions': { norender: true },
  'ui:options': { autocomplete: 'off' },
}

function executable(
  binding: McpBinding,
  inputSchema: JsonSchema,
  value: {
    title?: string
    description?: string
  },
): Executable {
  const labels = {
    tool: { badge: 'TOOL', accent: 'var(--accent-mcp-tool)', group: 'Tools' },
    resource: {
      badge: 'RES',
      accent: 'var(--accent-mcp-resource)',
      group: 'Resources',
    },
    'resource-template': {
      badge: 'TMPL',
      accent: 'var(--accent-mcp-template)',
      group: 'Resource templates',
    },
    prompt: {
      badge: 'PRMT',
      accent: 'var(--accent-mcp-prompt)',
      group: 'Prompts',
    },
  }[binding.kind]
  return {
    id: `${binding.kind}:${binding.name}`,
    name: binding.name,
    badge: labels.badge,
    accent: labels.accent,
    summary: value.title,
    description: value.description,
    groups: [labels.group],
    binding,
    inputSchema,
    inputUiSchema: FORM_UI,
  }
}

function toolExecutable(tool: Tool) {
  return executable(
    {
      type: 'mcp',
      kind: 'tool',
      method: 'tools/call',
      name: tool.name,
    },
    tool.inputSchema as JsonSchema,
    tool,
  )
}

function resourceExecutable(resource: Resource) {
  return executable(
    {
      type: 'mcp',
      kind: 'resource',
      method: 'resources/read',
      name: resource.uri,
    },
    {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    resource,
  )
}

function templateExecutable(template: ResourceTemplateType) {
  return executable(
    {
      type: 'mcp',
      kind: 'resource-template',
      method: 'resources/read',
      name: template.uriTemplate,
    },
    {
      type: 'object',
      properties: {
        uri: {
          type: 'string',
          title: 'Resource URI',
          default: template.uriTemplate,
          description: 'Replace the URI template variables with concrete values.',
        },
      },
      required: ['uri'],
      additionalProperties: false,
    },
    template,
  )
}

function promptExecutable(prompt: Prompt) {
  const properties = Object.fromEntries(
    (prompt.arguments ?? []).map((argument) => [
      argument.name,
      {
        type: 'string',
        title: argument.name,
        description: argument.description,
      },
    ]),
  )
  return executable(
    {
      type: 'mcp',
      kind: 'prompt',
      method: 'prompts/get',
      name: prompt.name,
    },
    {
      type: 'object',
      properties,
      required: (prompt.arguments ?? [])
        .filter((argument) => argument.required)
        .map((argument) => argument.name),
      additionalProperties: false,
    },
    prompt,
  )
}

export async function loadMcpSource(
  endpoint: string,
  id: string,
  credentials: Record<string, string>,
): Promise<ExecutableSource> {
  const { client, transport } = await getMcpConnection(id, endpoint, credentials)
  const [tools, resources, templates, prompts] = await Promise.all([
    client.listTools(),
    client.listResources(),
    client.listResourceTemplates(),
    client.listPrompts(),
  ])
  const serverInfo = client.getServerVersion()
  const capabilities = client.getServerCapabilities() ?? {}
  const instructions = client.getInstructions()
  const protocolVersion = client.getNegotiatedProtocolVersion() ?? 'unknown'
  const era = client.getProtocolEra() ?? 'legacy'
  const executables = [
    ...tools.tools.map(toolExecutable),
    ...resources.resources.map(resourceExecutable),
    ...templates.resourceTemplates.map(templateExecutable),
    ...prompts.prompts.map(promptExecutable),
  ]
  if (executables.length === 0) {
    throw new Error('This MCP server did not advertise tools, resources, templates, or prompts.')
  }

  return {
    id,
    kind: 'mcp',
    title: serverInfo?.name ?? new URL(endpoint).hostname,
    version: serverInfo?.version,
    description: instructions,
    sourceUrl: endpoint,
    targets: [endpoint],
    executables,
    groups: [
      { name: 'Tools', description: 'Functions exposed by this MCP server.' },
      { name: 'Resources', description: 'Fixed resources available to read.' },
      {
        name: 'Resource templates',
        description: 'Parameterized resource URIs available to read.',
      },
      { name: 'Prompts', description: 'Prompt templates exposed by this server.' },
    ],
    labels: {
      source: 'MCP server',
      sourcePlural: 'MCP servers',
      executable: 'RPC',
      executablePlural: 'RPCs',
      target: 'Endpoint',
      execute: 'Call',
      executing: 'Calling…',
      executed: 'Call again',
      export: 'Copy MCP client code',
      exported: 'Copied MCP client code',
    },
    adapterData: {
      era,
      protocolVersion,
      capabilities,
      serverInfo,
      instructions,
      sessionId: transport.sessionId,
    } satisfies McpAdapterData & { sessionId?: string },
    credentialSchema: {
      type: 'object',
      title: 'Connection credentials',
      properties: {
        bearerToken: {
          type: 'string',
          title: 'Bearer token',
        },
        headers: {
          type: 'string',
          title: 'Additional headers as JSON',
        },
      },
    },
    credentialUiSchema: {
      bearerToken: { 'ui:widget': 'password' },
    },
    credentialsRequired: false,
  }
}

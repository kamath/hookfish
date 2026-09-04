import type {
  Annotations,
  Prompt,
  Resource,
  ResourceTemplateType,
  Tool,
  ToolAnnotations,
} from '@modelcontextprotocol/client'
import type {
  Executable,
  ExecutableAnnotation,
  ExecutableSource,
  FormUiSchema,
  JsonSchema,
  McpBinding,
} from '../client-types'
import { withMcpConnection } from './client'
import { hasMcpOAuthTokens } from './oauth'

export type McpAdapterData = {
  era: 'modern' | 'legacy'
  protocolVersion: string
  capabilities: Record<string, unknown>
  serverInfo?: {
    name: string
    version: string
  }
  instructions?: string
  oauthAuthorized?: boolean
}

const FORM_UI: FormUiSchema = {
  'ui:submitButtonOptions': { norender: true },
  'ui:options': { autocomplete: 'off' },
}

// Every annotation is a hint: servers are not held to them, so both sides of a
// boolean hint are worth showing when a server bothers to state one.
export function toolAnnotations(annotations?: ToolAnnotations): ExecutableAnnotation[] {
  const shown: ExecutableAnnotation[] = []
  const hint = (
    value: boolean | undefined,
    whenTrue: ExecutableAnnotation,
    whenFalse: ExecutableAnnotation,
  ) => {
    if (value === true) {
      shown.push(whenTrue)
    } else if (value === false) {
      shown.push(whenFalse)
    }
  }
  hint(
    annotations?.readOnlyHint,
    { label: 'read-only', detail: 'Does not modify its environment.' },
    { label: 'writes', detail: 'May modify its environment.' },
  )
  hint(
    annotations?.destructiveHint,
    { label: 'destructive', detail: 'May perform destructive updates.' },
    { label: 'additive', detail: 'Performs only additive updates.' },
  )
  hint(
    annotations?.idempotentHint,
    {
      label: 'idempotent',
      detail: 'Repeat calls with the same arguments have no additional effect.',
    },
    {
      label: 'not idempotent',
      detail: 'Repeat calls with the same arguments have additional effects.',
    },
  )
  hint(
    annotations?.openWorldHint,
    { label: 'open world', detail: 'Interacts with external entities.' },
    { label: 'closed world', detail: 'Interacts with a closed set of entities.' },
  )
  return shown
}

export function contentAnnotations(annotations?: Annotations): ExecutableAnnotation[] {
  const shown: ExecutableAnnotation[] = []
  if (annotations?.audience?.length) {
    shown.push({
      label: `audience ${annotations.audience.join(', ')}`,
      detail: 'Intended for these participants.',
    })
  }
  if (typeof annotations?.priority === 'number') {
    shown.push({
      label: `priority ${annotations.priority}`,
      detail: 'How important this is, from 0 (least) to 1 (most).',
    })
  }
  if (annotations?.lastModified) {
    shown.push({
      label: `modified ${annotations.lastModified}`,
      detail: 'Last modification time reported by the server.',
    })
  }
  return shown
}

function executable(
  binding: McpBinding,
  inputSchema: JsonSchema,
  value: {
    title?: string
    description?: string
    outputSchema?: JsonSchema
    annotations?: ExecutableAnnotation[]
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
    outputSchema: value.outputSchema,
    annotations: value.annotations?.length ? value.annotations : undefined,
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
    {
      // The spec's display precedence for tools is title, then annotations.title, then name.
      title: tool.title ?? tool.annotations?.title,
      description: tool.description,
      outputSchema: tool.outputSchema as JsonSchema | undefined,
      annotations: toolAnnotations(tool.annotations),
    },
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
    {
      title: resource.title,
      description: resource.description,
      annotations: contentAnnotations(resource.annotations),
    },
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
    {
      title: template.title,
      description: template.description,
      annotations: contentAnnotations(template.annotations),
    },
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
    {
      title: prompt.title,
      description: prompt.description,
    },
  )
}

export async function loadMcpSource(
  endpoint: string,
  id: string,
  _credentials: Record<string, string>,
): Promise<ExecutableSource> {
  return withMcpConnection(id, endpoint, async ({ client, transport }) => {
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
      throw new Error(
        'This MCP server did not advertise tools, resources, templates, or prompts.',
      )
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
        export: 'Copy code',
        exported: 'Copied',
      },
      adapterData: {
        era,
        protocolVersion,
        capabilities,
        serverInfo,
        instructions,
        sessionId: transport.sessionId,
        oauthAuthorized: hasMcpOAuthTokens(id),
      } satisfies McpAdapterData & { sessionId?: string },
    }
  })
}

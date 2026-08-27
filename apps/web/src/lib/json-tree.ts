export type JsonNode = {
  id: string
  label?: string
  value?: unknown
  decoded?: unknown
  depth: number
  raw?: boolean
  toggleId?: string
  children?: JsonNode[]
  collection?: 'array' | 'object'
  property?: boolean
}

export function decodeJsonString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return undefined
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown
    return parsed !== null && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

export function buildNode(
  value: unknown,
  id = 'root',
  depth = 0,
  label?: string,
  property = false,
): JsonNode {
  const decoded = decodeJsonString(value)
  const structure = decoded ?? value
  if (Array.isArray(structure)) {
    return {
      id,
      label,
      value,
      decoded,
      depth,
      collection: 'array',
      children: structure.map((item, index) =>
        buildNode(item, `${id}.${index}`, depth + 1, `[${index}]`),
      ),
      property,
    }
  }
  if (structure !== null && typeof structure === 'object') {
    return {
      id,
      label,
      value,
      decoded,
      depth,
      collection: 'object',
      children: Object.entries(structure).map(([key, item], index) =>
        buildNode(item, `${id}.${index}`, depth + 1, key, true),
      ),
      property,
    }
  }
  return { id, label, value, depth, property }
}

export function parseJsonBody(body: string): { root?: JsonNode; lines?: string[] } {
  if (!body) {
    return { lines: ['Empty body'] }
  }
  try {
    return { root: buildNode(JSON.parse(body)) }
  } catch {
    return { lines: body.split('\n') }
  }
}

export function visibleNodes(node: JsonNode, expanded: Set<string>): JsonNode[] {
  const rows = [node]
  if (!node.children || !expanded.has(node.id)) {
    return rows
  }
  for (const child of node.children) {
    rows.push(...visibleNodes(child, expanded))
  }
  rows.push({
    id: `${node.id}.close`,
    depth: node.depth,
    raw: true,
    toggleId: node.id,
    value: node.collection === 'array' ? ']' : '}',
  })
  return rows
}

export function findNode(node: JsonNode, id: string): JsonNode | undefined {
  if (node.id === id) {
    return node
  }
  for (const child of node.children ?? []) {
    const match = findNode(child, id)
    if (match) {
      return match
    }
  }
  return undefined
}

export function collectionMark(node: JsonNode, expanded: boolean) {
  if (!node.collection) {
    return ''
  }
  const [open, close] = node.collection === 'array' ? ['[', ']'] : ['{', '}']
  return expanded ? open : `${open}…${close}`
}

export function scalarText(value: unknown) {
  const encoded = JSON.stringify(value)
  return encoded === undefined ? String(value) : encoded
}

export function selectedJsonText(root: JsonNode, row: JsonNode) {
  const node = findNode(root, row.toggleId ?? row.id)
  if (!node) {
    return
  }
  const value = node.decoded ?? node.value
  return JSON.stringify(
    node.property && node.label !== undefined ? { [node.label]: value } : value,
    null,
    2,
  )
}

export function expandedIds(node: JsonNode | undefined, depth: number): Set<string> {
  const ids = new Set<string>()
  function visit(current: JsonNode, remaining: number) {
    if (!current.collection || remaining < 0) {
      return
    }
    ids.add(current.id)
    if (remaining === 0) {
      return
    }
    for (const child of current.children ?? []) {
      visit(child, remaining - 1)
    }
  }
  if (node) {
    visit(node, depth)
  }
  return ids
}

export function lineNodes(lines: string[]): JsonNode[] {
  return lines.map((value, index): JsonNode => ({
    id: `line.${index}`,
    value,
    depth: 0,
    raw: true,
  }))
}

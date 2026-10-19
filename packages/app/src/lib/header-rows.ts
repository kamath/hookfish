import { parseHeaderText, type HeaderEntry } from '@hookfish/api'

export type HeaderField = 'name' | 'value'

export function isBlankHeader(row: HeaderEntry) {
  return !row.name.trim() && !row.value.trim()
}

// Keeps a blank row at the end so there is always somewhere to type the next header.
export function withTrailingRow(rows: HeaderEntry[]): HeaderEntry[] {
  const last = rows.at(-1)
  return last && isBlankHeader(last) ? rows : [...rows, { name: '', value: '' }]
}

// A paste into a name field fills rows whenever it reads as headers. A paste into a value
// field only does when it spans lines, so a single-line value containing `=` or `:` stays put.
export function pastedHeaders(text: string, field: HeaderField): HeaderEntry[] | undefined {
  if (field === 'value' && !/\r?\n/.test(text.trim())) {
    return undefined
  }
  return parseHeaderText(text)
}

// Spreads pasted headers from the row they were pasted into. A pasted name replaces any row
// with the same name, and blank rows other than the trailing one are dropped.
export function pasteHeaderRows(
  rows: HeaderEntry[],
  index: number,
  pasted: HeaderEntry[],
): HeaderEntry[] {
  const names = new Set(pasted.map((entry) => entry.name.trim().toLowerCase()))
  const keep = (row: HeaderEntry) =>
    !isBlankHeader(row) && !names.has(row.name.trim().toLowerCase())
  return withTrailingRow([
    ...rows.slice(0, index + 1).filter(keep),
    ...pasted,
    ...rows.slice(index + 1).filter(keep),
  ])
}

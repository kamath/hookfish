import { parseHeaderText, type HeaderEntry } from '@hookfish/api'

export type HeaderField = 'name' | 'value'

const blankHeader = (): HeaderEntry => ({ name: '', value: '' })

export function isBlankHeader(row: HeaderEntry) {
  return !row.name.trim() && !row.value.trim()
}

// There is always at least one row to type into.
export function headerRowsOrBlank(rows: HeaderEntry[]): HeaderEntry[] {
  return rows.length > 0 ? rows : [blankHeader()]
}

// Adds a blank row after `index` and returns where it is. An existing blank row there is
// reused, so pressing Enter twice does not stack up empty rows.
export function addHeaderRow(
  rows: HeaderEntry[],
  index = rows.length - 1,
): { rows: HeaderEntry[]; index: number } {
  const shown = headerRowsOrBlank(rows)
  const next = shown[index + 1]
  if (next && isBlankHeader(next)) {
    return { rows: shown, index: index + 1 }
  }
  if (index === shown.length - 1 && isBlankHeader(shown[index])) {
    return { rows: shown, index }
  }
  return {
    rows: [...shown.slice(0, index + 1), blankHeader(), ...shown.slice(index + 1)],
    index: index + 1,
  }
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
// with the same name, and blank rows are dropped.
export function pasteHeaderRows(
  rows: HeaderEntry[],
  index: number,
  pasted: HeaderEntry[],
): HeaderEntry[] {
  const names = new Set(pasted.map((entry) => entry.name.trim().toLowerCase()))
  const keep = (row: HeaderEntry) =>
    !isBlankHeader(row) && !names.has(row.name.trim().toLowerCase())
  return headerRowsOrBlank([
    ...rows.slice(0, index + 1).filter(keep),
    ...pasted,
    ...rows.slice(index + 1).filter(keep),
  ])
}

export function revealInList(row: HTMLElement | null, list: HTMLElement | null) {
  if (!row || !list) {
    return
  }
  const rowRect = row.getBoundingClientRect()
  const listRect = list.getBoundingClientRect()
  if (rowRect.top < listRect.top) {
    list.scrollTop -= listRect.top - rowRect.top
  } else if (rowRect.bottom > listRect.bottom) {
    list.scrollTop += rowRect.bottom - listRect.bottom
  }
}

const INPUT_SELECTOR = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[data-oc-toggle]',
].join(',')

function isVisible(element: HTMLElement) {
  return (
    element.checkVisibility?.({
      checkOpacity: true,
      checkVisibilityCSS: true,
    }) ?? element.getClientRects().length > 0
  )
}

export function listFormInputs(rootId: string): HTMLElement[] {
  const root = document.getElementById(rootId)
  if (!root) {
    return []
  }
  return [...root.querySelectorAll<HTMLElement>(INPUT_SELECTOR)].filter(isVisible)
}

function indexOfActive(items: HTMLElement[], delta: number): number {
  const active = document.activeElement
  const exact = items.findIndex((item) => item === active)
  if (exact !== -1) {
    return exact
  }

  if (!(active instanceof Node)) {
    return delta > 0 ? -1 : items.length
  }

  if (delta > 0) {
    const following = items.findIndex(
      (item) =>
        (active.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    )
    return following === -1 ? items.length - 1 : following - 1
  }

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    if (
      item &&
      (active.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_PRECEDING) !== 0
    ) {
      return index + 1
    }
  }
  return 0
}

export function moveInputTab(rootId: string, delta: number): boolean {
  const items = listFormInputs(rootId)
  if (items.length === 0) {
    return false
  }
  const current = indexOfActive(items, delta)
  const index = (current + delta + items.length) % items.length
  const next = items[index]
  if (!next) {
    return false
  }
  next.focus()
  next.scrollIntoView({ block: 'nearest' })
  return true
}

export function focusFirstInput(rootId: string): boolean {
  const first = listFormInputs(rootId).find((item) => !item.matches('[data-oc-toggle]'))
    ?? listFormInputs(rootId)[0]
  if (!first) {
    return false
  }
  first.focus()
  first.scrollIntoView({ block: 'nearest' })
  return true
}

export function activateFocusedControl(): boolean {
  const active = document.activeElement
  if (active instanceof HTMLElement && active.dataset.ocToggle !== undefined) {
    active.click()
    return true
  }
  return false
}

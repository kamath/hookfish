import { blurActive, isEditing } from './focus'

const TABBABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function isVisible(element: HTMLElement) {
  return (
    element.checkVisibility?.({
      checkOpacity: true,
      checkVisibilityCSS: true,
    }) ?? element.getClientRects().length > 0
  )
}

function isTabbable(element: HTMLElement) {
  if (!isVisible(element) || element.tabIndex < 0) {
    return false
  }
  if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
    return !element.disabled
  }
  return true
}

export function listFormInputs(rootId: string): HTMLElement[] {
  const root = document.getElementById(rootId)
  if (!root) {
    return []
  }
  return [...root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)].filter(isTabbable)
}

function formRoot(rootId: string): HTMLElement | null {
  return document.getElementById(rootId)
}

function clearCurrent(root: HTMLElement) {
  for (const element of root.querySelectorAll('[data-oc-current]')) {
    element.removeAttribute('data-oc-current')
  }
}

function markItem(root: HTMLElement, item: HTMLElement) {
  clearCurrent(root)
  const field = item.closest<HTMLElement>('[data-oc-nav="field"]')
  ;(field ?? item).dataset.ocCurrent = 'true'
}

function indexOfItem(items: HTMLElement[], target: Element | null): number {
  if (!(target instanceof HTMLElement)) {
    return -1
  }
  return items.findIndex(
    (item) => item === target || item.contains(target) || target.contains(item),
  )
}

function indexOfCurrent(root: HTMLElement, items: HTMLElement[], delta: number): number {
  const focused = indexOfItem(items, document.activeElement)
  if (focused !== -1) {
    return focused
  }

  const marked = root.querySelector('[data-oc-current="true"]')
  const markedIndex = indexOfItem(items, marked)
  if (markedIndex !== -1) {
    return markedIndex
  }

  if (!(active instanceof Node) || !root.contains(active)) {
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

export function currentFormItem(rootId: string): HTMLElement | undefined {
  const root = formRoot(rootId)
  const items = listFormInputs(rootId)
  if (!root) {
    return items[0]
  }
  const focused = indexOfItem(items, document.activeElement)
  if (focused !== -1) {
    return items[focused]
  }
  const marked = root.querySelector('[data-oc-current="true"]')
  const markedIndex = indexOfItem(items, marked)
  if (markedIndex !== -1) {
    return items[markedIndex]
  }
  return undefined
}

export function bindFormTabSync(rootId: string) {
  const root = formRoot(rootId)
  if (!root) {
    return () => {}
  }

  const onFocusIn = (event: FocusEvent) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }
    const items = listFormInputs(rootId)
    const index = indexOfItem(items, target)
    if (index !== -1 && items[index]) {
      markItem(root, items[index])
    }
  }

  root.addEventListener('focusin', onFocusIn)
  return () => {
    root.removeEventListener('focusin', onFocusIn)
  }
}

export function moveInputTab(rootId: string, delta: number): boolean {
  if (isEditing()) {
    return false
  }

  const root = formRoot(rootId)
  const items = listFormInputs(rootId)
  if (!root || items.length === 0) {
    return false
  }

  const current = indexOfCurrent(root, items, delta)
  const index = (current + delta + items.length) % items.length
  const next = items[index]
  if (!next) {
    return false
  }

  markItem(root, next)
  next.scrollIntoView({ block: 'nearest' })
  return true
}

export function selectFirstInput(rootId: string): boolean {
  const root = formRoot(rootId)
  const items = listFormInputs(rootId)
  const first = items[0]
  if (!root || !first) {
    return false
  }
  markItem(root, first)
  first.scrollIntoView({ block: 'nearest' })
  return true
}

export function insertCurrentInput(rootId: string): boolean {
  const root = formRoot(rootId)
  const items = listFormInputs(rootId)
  if (!root || items.length === 0) {
    return false
  }

  const target = currentFormItem(rootId) ?? items[0]

  if (!target) {
    return false
  }

  markItem(root, target)
  target.focus()
  target.scrollIntoView({ block: 'nearest' })
  return true
}

export function focusFirstInput(rootId: string): boolean {
  return insertCurrentInput(rootId)
}

export function exitInsert(rootId: string): boolean {
  if (!isEditing()) {
    return false
  }

  const root = formRoot(rootId)
  const items = listFormInputs(rootId)
  const active = document.activeElement
  const index = items.findIndex((item) => item === active)
  blurActive()
  if (root && index !== -1 && items[index]) {
    markItem(root, items[index])
  }
  return true
}

export function activateCurrentControl(rootId: string): boolean {
  const item = currentFormItem(rootId)
  if (!item) {
    return false
  }
  if (item.dataset.ocToggle !== undefined || item instanceof HTMLButtonElement) {
    item.click()
    return true
  }
  return false
}

export function activateFocusedControl(): boolean {
  const active = document.activeElement
  if (active instanceof HTMLElement && active.dataset.ocToggle !== undefined) {
    active.click()
    return true
  }
  return false
}

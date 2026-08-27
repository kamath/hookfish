import { blurActive, isEditing } from './focus'
import { enterCommand, enterEdit, isInsertMode, type Pane } from './chrome'
import { consumePointerIntent, usePaneActions } from './keys'

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

type FormInputCache = {
  dirty: boolean
  items: HTMLElement[]
  observer?: MutationObserver
}

const formInputCaches = new WeakMap<HTMLElement, FormInputCache>()

function cachedFormInputs(root: HTMLElement) {
  let cache = formInputCaches.get(root)
  if (!cache) {
    cache = { dirty: true, items: [] }
    if (typeof MutationObserver !== 'undefined') {
      cache.observer = new MutationObserver(() => {
        if (cache) {
          cache.dirty = true
        }
      })
      cache.observer.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'disabled', 'hidden', 'style', 'tabindex', 'type'],
      })
    }
    formInputCaches.set(root, cache)
  }

  if (cache.observer?.takeRecords().length) {
    cache.dirty = true
  }
  if (cache.dirty) {
    cache.items = [...root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)].filter(isTabbable)
    cache.dirty = false
  }
  return cache.items
}

export function listFormInputs(rootId: string): HTMLElement[] {
  const root = document.getElementById(rootId)
  if (!root) {
    return []
  }
  return cachedFormInputs(root)
}

function formRoot(rootId: string): HTMLElement | null {
  return document.getElementById(rootId)
}

function syncMode(root: HTMLElement) {
  root.dataset.ocMode = isInsertMode() ? 'insert' : 'command'
}

const EDITABLE_SELECTOR = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
  'textarea',
  'select',
].join(',')

let insertFocusTimer = 0

function isEditableControl(element: HTMLElement) {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return true
  }
  if (element instanceof HTMLInputElement) {
    return !['button', 'submit', 'reset', 'hidden'].includes(element.type.toLowerCase())
  }
  return element.isContentEditable
}

function markedScope(root: HTMLElement): HTMLElement {
  return root.querySelector<HTMLElement>('[data-oc-current="true"]') ?? root
}

function editableIn(scope: HTMLElement): HTMLElement | undefined {
  if (isEditableControl(scope)) {
    return scope
  }
  return [...scope.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)].find(isTabbable)
}

function scrollMark(element: HTMLElement) {
  const field = element.closest<HTMLElement>('[data-oc-nav="field"]') ?? element
  field.scrollIntoView({ block: 'nearest' })
}

const PICKER_INPUT_TYPES = ['color', 'date', 'datetime-local', 'file', 'month', 'time', 'week']

function pickerFor(target: HTMLElement) {
  if (target instanceof HTMLSelectElement) {
    return target
  }
  if (!(target instanceof HTMLInputElement)) {
    return undefined
  }
  // A datalist turns an otherwise plain text input into a picker too.
  const picker = PICKER_INPUT_TYPES.includes(target.type.toLowerCase()) || Boolean(target.list)
  return picker ? target : undefined
}

function focusInsertTarget(element: HTMLElement) {
  const target = editableIn(element) ?? element
  target.focus({ preventScroll: true })
  if (
    (target instanceof HTMLInputElement &&
      /^(text|search|url|tel|password|email|number)$/.test(target.type)) ||
    target instanceof HTMLTextAreaElement
  ) {
    const end = target.value.length
    try {
      target.setSelectionRange(end, end)
    } catch {
      // Some input types reject a selection range.
    }
  }
  try {
    pickerFor(target)?.showPicker?.()
  } catch {
    // showPicker needs transient user activation and is not universally supported.
  }
}

function scheduleInsertFocus(element: HTMLElement) {
  window.clearTimeout(insertFocusTimer)
  insertFocusTimer = window.setTimeout(() => {
    insertFocusTimer = 0
    if (!isInsertMode()) {
      return
    }
    focusInsertTarget(element)
  }, 0)
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
  const exact = items.indexOf(target)
  if (exact !== -1) {
    return exact
  }
  const enclosing = items.findIndex((item) => item.contains(target))
  if (enclosing !== -1) {
    return enclosing
  }
  if (target.dataset.ocNav !== undefined || target.dataset.ocCurrent === 'true') {
    return items.findIndex((item) => target.contains(item))
  }
  return -1
}

function indexOfCurrent(root: HTMLElement, items: HTMLElement[], delta: number): number {
  const active = document.activeElement
  if (active instanceof HTMLElement && root.contains(active)) {
    const focused = indexOfItem(items, active)
    if (focused !== -1) {
      return focused
    }
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
      (item) => (active.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    )
    return following === -1 ? items.length - 1 : following - 1
  }

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    if (item && (active.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_PRECEDING) !== 0) {
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
  if (document.activeElement instanceof HTMLElement && root.contains(document.activeElement)) {
    const focused = indexOfItem(items, document.activeElement)
    if (focused !== -1) {
      return items[focused]
    }
  }
  const marked = root.querySelector('[data-oc-current="true"]')
  const markedIndex = indexOfItem(items, marked)
  if (markedIndex !== -1) {
    return items[markedIndex]
  }
  return undefined
}

function itemFromTarget(root: HTMLElement, target: HTMLElement, items: HTMLElement[]) {
  const field = target.closest<HTMLElement>('[data-oc-nav="field"]')
  if (field && root.contains(field)) {
    return editableIn(field) ?? items[indexOfItem(items, field)]
  }

  const toggle = target.closest<HTMLElement>('[data-oc-toggle], .oc-fold, button[type="submit"]')
  if (toggle && root.contains(toggle)) {
    const index = indexOfItem(items, toggle)
    return index === -1 ? toggle : items[index]
  }

  const index = indexOfItem(items, target)
  return index === -1 ? undefined : items[index]
}

function isSameMark(root: HTMLElement, item: HTMLElement) {
  const marked = root.querySelector<HTMLElement>('[data-oc-current="true"]')
  if (!marked) {
    return false
  }
  return marked === item || marked.contains(item) || item.contains(marked)
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
    if (index === -1 || !items[index]) {
      return
    }
    markItem(root, items[index])
    if (isEditing()) {
      enterEdit()
    }
    syncMode(root)
  }

  const onPointerOver = (event: PointerEvent) => {
    if (!consumePointerIntent()) {
      return
    }
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }
    const items = listFormInputs(rootId)
    const next = itemFromTarget(root, target, items)
    if (!next || isSameMark(root, next)) {
      return
    }
    if (isEditing()) {
      blurActive()
      enterCommand()
    }
    markItem(root, next)
    syncMode(root)
  }

  root.addEventListener('focusin', onFocusIn)
  root.addEventListener('pointerover', onPointerOver)
  return () => {
    root.removeEventListener('focusin', onFocusIn)
    root.removeEventListener('pointerover', onPointerOver)
    formInputCaches.get(root)?.observer?.disconnect()
    formInputCaches.delete(root)
  }
}

export function moveFormTab(rootId: string, delta: number): boolean {
  if (isInsertMode() && isEditing()) {
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

  enterCommand()
  blurActive()
  markItem(root, next)
  syncMode(root)
  scrollMark(next)
  return true
}

export function moveInputTab(rootId: string, delta: number): boolean {
  return moveFormTab(rootId, delta)
}

function firstRequiredInput(root: HTMLElement): HTMLElement | undefined {
  for (const field of root.querySelectorAll<HTMLElement>(
    '[data-oc-nav="field"][data-oc-required="true"]',
  )) {
    const input = editableIn(field)
    if (input && isTabbable(input)) {
      return input
    }
  }
  return listFormInputs(root.id).find(
    (item) =>
      isEditableControl(item) && 'required' in item && Boolean((item as HTMLInputElement).required),
  )
}

function submitControl(root: HTMLElement, items: HTMLElement[]): HTMLElement | undefined {
  const send = root.querySelector<HTMLElement>('button[type="submit"]:not([disabled])')
  if (send && isTabbable(send)) {
    return send
  }
  return items.find((item) => item instanceof HTMLButtonElement && item.type === 'submit')
}

export function selectDefaultInput(rootId: string): boolean {
  const root = formRoot(rootId)
  const items = listFormInputs(rootId)
  if (!root) {
    return false
  }

  const required = firstRequiredInput(root)
  if (required) {
    markItem(root, required)
    enterEdit()
    syncMode(root)
    scrollMark(required)
    scheduleInsertFocus(required)
    return true
  }

  const send = submitControl(root, items)
  if (!send) {
    return false
  }

  enterCommand()
  markItem(root, send)
  syncMode(root)
  scrollMark(send)
  send.focus({ preventScroll: true })
  return true
}

export function selectDefaultFormItem(rootId: string): boolean {
  const root = formRoot(rootId)
  const items = listFormInputs(rootId)
  if (!root) {
    return false
  }

  const target = firstRequiredInput(root) ?? submitControl(root, items)
  if (!target) {
    return false
  }

  blurActive()
  enterCommand()
  markItem(root, target)
  syncMode(root)
  scrollMark(target)
  return true
}

export function selectFirstInput(rootId: string): boolean {
  return selectDefaultInput(rootId)
}

export function useFormPaneNavigation(
  pane: Pane,
  formId: string,
  options?: { stepKeys?: boolean; enabled?: boolean },
) {
  const enabled = options?.enabled !== false
  usePaneActions(
    pane,
    enabled
      ? {
          next: {
            callback: () => {
              moveFormTab(formId, 1)
            },
            enabled: options?.stepKeys !== false,
            ignoreInputs: false,
          },
          previous: {
            callback: () => {
              moveFormTab(formId, -1)
            },
            enabled: options?.stepKeys !== false,
            ignoreInputs: false,
          },
          nextTab: {
            callback: () => {
              moveFormTab(formId, 1)
            },
            enabled: options?.stepKeys !== false,
            ignoreInputs: false,
          },
          previousTab: {
            callback: () => {
              moveFormTab(formId, -1)
            },
            enabled: options?.stepKeys !== false,
            ignoreInputs: false,
          },
          expand: () => {
            confirmForm(formId)
          },
          insert: () => {
            insertCurrentInput(formId)
          },
          command: (event) => {
            event.preventDefault()
            exitInsert(formId)
          },
        }
      : {},
  )
}

export function insertMatchingInput(
  rootId: string,
  match: (item: HTMLElement) => boolean,
): boolean {
  const root = formRoot(rootId)
  const items = listFormInputs(rootId)
  const target = items.find((item) => isEditableControl(item) && match(item))
  if (!root || !target) {
    return false
  }

  markItem(root, target)
  enterEdit()
  syncMode(root)
  scrollMark(target)
  blurActive()
  scheduleInsertFocus(target)
  return true
}

export function selectMatchingFormItem(
  rootId: string,
  match: (item: HTMLElement) => boolean,
): boolean {
  const root = formRoot(rootId)
  const items = listFormInputs(rootId)
  const target = items.find((item) => isEditableControl(item) && match(item))
  if (!root || !target) {
    return false
  }

  blurActive()
  enterCommand()
  markItem(root, target)
  syncMode(root)
  scrollMark(target)
  return true
}

export function insertCurrentInput(rootId: string): boolean {
  const root = formRoot(rootId)
  const items = listFormInputs(rootId)
  if (!root || items.length === 0) {
    return false
  }

  const target = editableIn(markedScope(root)) ?? currentFormItem(rootId) ?? items[0]
  if (!target) {
    return false
  }

  markItem(root, target)
  enterEdit()
  syncMode(root)
  scrollMark(target)
  blurActive()
  scheduleInsertFocus(target)
  return true
}

export function isTypingInCurrentField(rootId: string) {
  if (!isEditing()) {
    return false
  }
  const root = formRoot(rootId)
  const active = document.activeElement
  if (!root || !(active instanceof HTMLElement)) {
    return false
  }
  const marked = markedScope(root)
  return marked === active || marked.contains(active)
}

export function focusFirstInput(rootId: string): boolean {
  return insertCurrentInput(rootId)
}

export function exitInsert(rootId: string): boolean {
  if (!isEditing()) {
    const root = formRoot(rootId)
    if (isInsertMode() && root) {
      enterCommand()
      syncMode(root)
    }
    return false
  }

  const root = formRoot(rootId)
  const items = listFormInputs(rootId)
  const active = document.activeElement
  const index = items.findIndex((item) => item === active)
  blurActive()
  enterCommand()
  if (root) {
    if (index !== -1 && items[index]) {
      markItem(root, items[index])
    }
    syncMode(root)
  }
  return true
}

export function confirmForm(rootId: string): boolean {
  if (isEditing()) {
    return false
  }
  if (activateCurrentControl(rootId)) {
    return true
  }
  return insertCurrentInput(rootId)
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

export function isEditing() {
  const active = document.activeElement
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) {
    return true
  }
  if (active instanceof HTMLInputElement) {
    const type = active.type.toLowerCase()
    return type !== 'button' && type !== 'submit' && type !== 'reset'
  }
  return active instanceof HTMLElement && active.isContentEditable
}

export function blurActive() {
  const active = document.activeElement
  if (active instanceof HTMLElement) {
    active.blur()
  }
}

export function focusFirstField(rootId: string) {
  const field = document.querySelector<HTMLElement>(
    `#${rootId} input:not([type="hidden"]):not([type="submit"]), #${rootId} textarea, #${rootId} select`,
  )
  field?.focus()
}

export function submitForm(id: string) {
  const form = document.getElementById(id)
  if (form instanceof HTMLFormElement) {
    form.requestSubmit()
  }
}

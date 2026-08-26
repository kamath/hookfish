export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.dataset.ocClipboardFallback = 'true'
    area.style.position = 'fixed'
    area.style.left = '-9999px'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    area.remove()
    previouslyFocused?.focus({ preventScroll: true })
    return copied
  }
}

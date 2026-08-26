let insert = false
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

export function isInsertMode() {
  return insert
}

export function setInsertMode(next: boolean) {
  if (insert === next) {
    return
  }
  insert = next
  notify()
}

export function subscribeFormMode(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

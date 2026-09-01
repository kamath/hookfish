const formDataByApi = new Map<string, Map<string, unknown>>()
const operationViewStorageKey = 'oc:operation-view'

function storageKey(apiId: string, operationId: string) {
  return `oc:operation-form:${encodeURIComponent(apiId)}:${encodeURIComponent(operationId)}`
}

function readSessionForm(apiId: string, operationId: string) {
  if (typeof window === 'undefined') {
    return undefined
  }
  try {
    const raw = window.sessionStorage.getItem(storageKey(apiId, operationId))
    return raw === null ? undefined : (JSON.parse(raw) as unknown)
  } catch {
    return undefined
  }
}

export function readOperationFormData(apiId: string, operationId: string): unknown {
  const operations = formDataByApi.get(apiId)
  if (operations?.has(operationId)) {
    return operations.get(operationId)
  }
  const persisted = readSessionForm(apiId, operationId)
  if (persisted !== undefined) {
    writeMemoryForm(apiId, operationId, persisted)
    return persisted
  }
  return {}
}

function writeMemoryForm(
  apiId: string,
  operationId: string,
  formData: unknown,
) {
  let operations = formDataByApi.get(apiId)
  if (!operations) {
    operations = new Map()
    formDataByApi.set(apiId, operations)
  }
  operations.set(operationId, formData)
}

export function writeOperationFormData(
  apiId: string,
  operationId: string,
  formData: unknown,
) {
  writeMemoryForm(apiId, operationId, formData)
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.sessionStorage.setItem(
      storageKey(apiId, operationId),
      JSON.stringify(formData),
    )
  } catch {
    // In-memory drafts still work when session storage is unavailable.
  }
}

export function readOperationInspecting() {
  if (typeof window === 'undefined') {
    return true
  }
  try {
    return window.sessionStorage.getItem(operationViewStorageKey) !== 'input'
  } catch {
    return true
  }
}

export function writeOperationInspecting(inspecting: boolean) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.sessionStorage.setItem(
      operationViewStorageKey,
      inspecting ? 'metadata' : 'input',
    )
  } catch {
    // Keep the current in-memory view when session storage is unavailable.
  }
}

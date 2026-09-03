const formDataByApi = new Map<string, Map<string, unknown>>()

export function readOperationFormData(apiId: string, operationId: string): unknown {
  const operations = formDataByApi.get(apiId)
  if (!operations?.has(operationId)) {
    return {}
  }
  return operations.get(operationId)
}

export function writeOperationFormData(
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

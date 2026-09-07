// Base64 adds roughly 33% before the upload crosses the JSON proxy boundary.
// Two megabytes keeps the complete request below common serverless body limits.
export const MAX_UPLOAD_BYTES = 2_000_000

export type EncodedFile = {
  data: string
  filename: string
  mediaType: string
}

export function parseFileDataUrl(value: unknown): EncodedFile | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const match = value.match(
    /^data:([^;,]*)(?:;name=([^;]*))?;base64,([A-Za-z0-9+/]*={0,2})$/,
  )
  if (!match) {
    return undefined
  }
  let filename = 'upload'
  if (match[2]) {
    try {
      filename = decodeURIComponent(match[2])
    } catch {
      return undefined
    }
  }
  return {
    mediaType: match[1] || 'application/octet-stream',
    filename,
    data: match[3] ?? '',
  }
}

export function withFileName(dataUrl: string, filename: string): string {
  const marker = ';base64,'
  const index = dataUrl.indexOf(marker)
  if (!dataUrl.startsWith('data:') || index < 0) {
    throw new Error('The selected file could not be read.')
  }
  return `${dataUrl.slice(0, index)};name=${encodeURIComponent(filename)}${dataUrl.slice(index)}`
}

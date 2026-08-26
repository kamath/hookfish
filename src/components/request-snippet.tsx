import { useEffect, useState } from 'react'
import type { ExecuteRequest } from '../lib/invoke'
import {
  isSnippetFormat,
  renderSnippet,
  SNIPPET_FORMATS,
  type SnippetFormat,
} from '../lib/export-snippet'
import { readSnippetFormat, writeSnippetFormat } from '../lib/storage'
import { formInputClass } from '../lib/ui'

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.left = '-9999px'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

export function RequestSnippet({ request }: { request: ExecuteRequest }) {
  const [format, setFormat] = useState<SnippetFormat>(readSnippetFormat)
  const [copied, setCopied] = useState(false)
  const snippet = renderSnippet(format, request)

  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  function chooseFormat(next: SnippetFormat) {
    setFormat(next)
    writeSnippetFormat(next)
    setCopied(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="snippet-format">
          Snippet library
        </label>
        <span className="relative inline-flex">
          <select
            id="snippet-format"
            className={`${formInputClass} w-auto min-h-8 min-w-[7rem] max-w-none appearance-none py-1 pr-6 pl-2`}
            value={format}
            onChange={(event) => {
              const next = event.target.value
              if (isSnippetFormat(next)) {
                chooseFormat(next)
              }
            }}
          >
            {SNIPPET_FORMATS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-[10px] text-mute"
          >
            ▼
          </span>
        </span>
        <button
          type="button"
          className="inline-flex min-h-8 items-center bg-ink/10 px-2.5 py-1 text-xs font-medium text-ink hover:bg-ink/15 focus-visible:bg-ink/15 outline-none"
          aria-live="polite"
          onClick={() => {
            void copyText(snippet).then((ok) => {
              if (ok) {
                setCopied(true)
              }
            })
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-mute">
        {snippet}
      </pre>
    </div>
  )
}

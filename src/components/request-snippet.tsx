import { useEffect, useState } from 'react'
import type { ExecuteRequest } from '../lib/invoke'
import {
  isSnippetFormat,
  renderSnippet,
  SNIPPET_FORMATS,
  type SnippetFormat,
} from '../lib/export-snippet'
import { readSnippetFormat, writeSnippetFormat } from '../lib/storage'
import { formGhostButtonClass, formInputClass } from '../lib/ui'

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
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-mute">
        {snippet}
      </pre>
      <div className="inline-flex self-start">
        <button
          type="button"
          className={`${formGhostButtonClass} border-r-0`}
          aria-live="polite"
          aria-label={copied ? 'Copied' : 'Copy request'}
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
        <label className="sr-only" htmlFor="snippet-format">
          Copy as
        </label>
        <span className="relative inline-flex">
          <select
            id="snippet-format"
            className={`${formInputClass} w-auto min-h-8 min-w-[6.75rem] max-w-none appearance-none border-l-0 py-1 pr-6 pl-2`}
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
            className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center font-mono text-[10px] text-mute"
          >
            ▾
          </span>
        </span>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { ExecuteRequest } from '../lib/invoke'
import {
  isSnippetFormat,
  renderSnippet,
  SNIPPET_FORMATS,
  type SnippetFormat,
} from '../lib/export-snippet'
import { readSnippetFormat, writeSnippetFormat } from '../lib/storage'

const PREVIEW_LINES = 5

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

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="5.5" y="5.5" width="8" height="8" />
      <path d="M10.5 5.5V3.5h-8v8H4.5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3.5 8.5l3 3 6-6" />
    </svg>
  )
}

export function RequestSnippet({ request }: { request: ExecuteRequest }) {
  const [format, setFormat] = useState<SnippetFormat>(readSnippetFormat)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const snippet = renderSnippet(format, request)
  const lines = snippet.split('\n')
  const overflow = lines.length - PREVIEW_LINES
  const collapsed = !expanded && overflow > 0
  const visible = collapsed ? lines.slice(0, PREVIEW_LINES).join('\n') : snippet

  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    setExpanded(false)
  }, [format])

  function chooseFormat(next: SnippetFormat) {
    setFormat(next)
    writeSnippetFormat(next)
    setCopied(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="sr-only" htmlFor="snippet-format">
        Snippet library
      </label>
      <span className="relative inline-flex self-start">
        <select
          id="snippet-format"
          className="min-h-8 w-auto min-w-[7rem] appearance-none border-0 bg-ink/10 py-1 pr-6 pl-2 text-xs text-ink outline-none"
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
      <div className="relative bg-ink/10">
        <button
          type="button"
          className="absolute top-1 right-1 inline-flex h-7 w-7 items-center justify-center text-mute hover:text-ink focus-visible:text-ink outline-none"
          aria-live="polite"
          aria-label={copied ? 'Copied' : 'Copy snippet'}
          onClick={() => {
            void copyText(snippet).then((ok) => {
              if (ok) {
                setCopied(true)
              }
            })
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all py-2 pr-9 pl-2.5 font-mono text-xs text-mute">
          {visible}
        </pre>
        {overflow > 0 ? (
          <button
            type="button"
            className="w-full px-2.5 pb-2 text-left text-[11px] text-mute hover:text-ink outline-none"
            onClick={() => setExpanded((value) => !value)}
          >
            {collapsed ? `${overflow} more lines` : 'Show less'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

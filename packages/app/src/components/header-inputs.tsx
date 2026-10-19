import { useState, type ClipboardEvent, type KeyboardEvent, type RefObject } from 'react'
import type { HeaderEntry } from '@hookfish/api'
import {
  addHeaderRow,
  headerRowsOrBlank,
  pasteHeaderRows,
  pastedHeaders,
  type HeaderField,
} from '../lib/header-rows'
import { softInputClass } from '../lib/ui'

export function focusHeaderField(index: number, field: HeaderField = 'name') {
  requestAnimationFrame(() => {
    document.getElementById(`header-${field}-${index}`)?.focus()
  })
}

export function HeaderInputs({
  rows,
  onChange,
  error,
  disabled,
  firstInputRef,
  onFocus,
  onClose,
}: {
  rows: HeaderEntry[]
  onChange: (rows: HeaderEntry[]) => void
  error?: string
  disabled?: boolean
  firstInputRef?: RefObject<HTMLInputElement | null>
  onFocus?: () => void
  /** Called when the last row is removed, so the caller can put the headers away. */
  onClose: () => void
}) {
  const shown = headerRowsOrBlank(rows)
  // Values are masked until revealed, since they are usually credentials.
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set())

  // Enter on a filled name moves to its value; on a filled value it adds another row.
  function enter(index: number, field: HeaderField) {
    return (event: KeyboardEvent<HTMLInputElement>) => {
      if (
        event.key !== 'Enter' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.nativeEvent.isComposing
      ) {
        return
      }
      event.preventDefault()
      if (!event.currentTarget.value.trim()) {
        return
      }
      if (field === 'name') {
        focusHeaderField(index, 'value')
        return
      }
      const next = addHeaderRow(shown, index)
      onChange(next.rows)
      focusHeaderField(next.index)
    }
  }

  function update(index: number, field: HeaderField, value: string) {
    onChange(shown.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  function paste(index: number, field: HeaderField) {
    return (event: ClipboardEvent<HTMLInputElement>) => {
      const pasted = pastedHeaders(event.clipboardData.getData('text'), field)
      if (!pasted) {
        return
      }
      event.preventDefault()
      const next = pasteHeaderRows(shown, index, pasted)
      onChange(next)
      focusHeaderField(next.length - 1, 'value')
    }
  }

  return (
    <div className="space-y-2">
      {shown.map((row, index) => (
        <div key={index} className="flex gap-2">
          <label htmlFor={`header-name-${index}`} className="sr-only">
            Header {index + 1} name
          </label>
          <div className="w-2/5 shrink-0">
            <input
              ref={index === 0 ? firstInputRef : undefined}
              id={`header-name-${index}`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'headers-error' : 'headers-hint'}
              className={`${softInputClass} font-mono text-xs`}
              placeholder={index === 0 ? 'Authorization' : 'Name'}
              value={row.name}
              onChange={(event) => update(index, 'name', event.target.value)}
              onPaste={paste(index, 'name')}
              onKeyDown={enter(index, 'name')}
              onFocus={onFocus}
            />
          </div>
          <label htmlFor={`header-value-${index}`} className="sr-only">
            Header {index + 1} value
          </label>
          <div className="relative min-w-0 flex-1">
            <input
              id={`header-value-${index}`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              // Masked with text-security rather than type="password" so browsers don't offer to save it.
              className={`${softInputClass} font-mono text-xs pr-24 ${revealed.has(index) ? '' : '[-webkit-text-security:disc]'}`}
              placeholder={index === 0 ? 'Bearer …' : 'Value'}
              value={row.value}
              onChange={(event) => update(index, 'value', event.target.value)}
              onPaste={paste(index, 'value')}
              onKeyDown={enter(index, 'value')}
              onFocus={onFocus}
            />
            <div className="absolute inset-y-0 right-0 flex">
              <button
                type="button"
                aria-label={`${revealed.has(index) ? 'Hide' : 'Show'} header ${index + 1} value`}
                aria-pressed={revealed.has(index)}
                className="px-2 text-xs text-mute outline-none hover:text-ink focus-visible:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const next = new Set(revealed)
                  if (!next.delete(index)) {
                    next.add(index)
                  }
                  setRevealed(next)
                }}
              >
                {revealed.has(index) ? 'Hide' : 'Show'}
              </button>
              <button
                type="button"
                aria-label={`Remove header ${index + 1}`}
                className="px-3 text-sm text-mute outline-none hover:text-ink focus-visible:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (shown.length === 1) {
                    onClose()
                    return
                  }
                  onChange(headerRowsOrBlank(shown.filter((_, i) => i !== index)))
                  // Rows shift up, so start the remaining ones masked again.
                  setRevealed(new Set())
                  focusHeaderField(Math.max(0, Math.min(index, shown.length - 2)))
                }}
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ))}
      {error ? (
        <p id="headers-error" className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : (
        <p id="headers-hint" className="text-xs text-mute">
          Paste .env lines, JSON, or Name: value lines to fill these in.
        </p>
      )}
    </div>
  )
}

import type { ClipboardEvent, KeyboardEvent, RefObject } from 'react'
import type { HeaderEntry } from '@hookfish/api'
import {
  addHeaderRow,
  headerRowsOrBlank,
  isBlankHeader,
  pasteHeaderRows,
  pastedHeaders,
  type HeaderField,
} from '../lib/header-rows'
import { softButtonClass, softInputClass } from '../lib/ui'

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
}: {
  rows: HeaderEntry[]
  onChange: (rows: HeaderEntry[]) => void
  error?: string
  disabled?: boolean
  firstInputRef?: RefObject<HTMLInputElement | null>
  onFocus?: () => void
}) {
  const shown = headerRowsOrBlank(rows)
  // The only row left can be cleared but not removed.
  const removable = shown.length > 1 || !isBlankHeader(shown[0])

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
    <div className="space-y-1">
      {shown.map((row, index) => (
        <div key={index} className="flex gap-1">
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
          <div className="min-w-0 flex-1">
            <input
              id={`header-value-${index}`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              className={`${softInputClass} font-mono text-xs`}
              placeholder={index === 0 ? 'Bearer …' : 'Value'}
              value={row.value}
              onChange={(event) => update(index, 'value', event.target.value)}
              onPaste={paste(index, 'value')}
              onKeyDown={enter(index, 'value')}
              onFocus={onFocus}
            />
          </div>
          <button
            type="button"
            aria-label={`Remove header ${index + 1}`}
            className={`${softButtonClass} px-3 ${removable ? '' : 'invisible'}`}
            disabled={disabled || !removable}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange(headerRowsOrBlank(shown.filter((_, i) => i !== index)))
              focusHeaderField(Math.max(0, Math.min(index, shown.length - 2)))
            }}
          >
            ×
          </button>
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

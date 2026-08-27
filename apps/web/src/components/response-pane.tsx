import { useEffect, useState } from 'react'
import type { ExecutionResult } from '../lib/client-types'
import { usePaneActions, usePaneFlags } from '../lib/keys'
import { paneBarButtonClass } from '../lib/ui'
import { Kbd, KeyHints } from './hints'
import { JsonView } from './json-view'

export function ResponsePane({
  result,
  pending,
  error,
  onBack,
  onResend,
  executeLabel,
  executingLabel,
  onContinue,
}: {
  result: ExecutionResult
  pending: boolean
  error: string | null
  onBack: () => void
  onResend: () => void
  executeLabel: string
  executingLabel: string
  onContinue?: (inputResponses: Record<string, unknown>) => void
}) {
  const [detailsVisible, setDetailsVisible] = useState(false)
  const [inputError, setInputError] = useState<string>()
  const [inputResponses, setInputResponses] = useState(() =>
    JSON.stringify(
      Object.fromEntries(
        Object.keys(result.inputRequired?.requests ?? {}).map((name) => [name, {}]),
      ),
      null,
      2,
    ),
  )

  useEffect(() => {
    setDetailsVisible(false)
    setInputError(undefined)
    setInputResponses(
      JSON.stringify(
        Object.fromEntries(
          Object.keys(result.inputRequired?.requests ?? {}).map((name) => [name, {}]),
        ),
        null,
        2,
      ),
    )
  }, [result])

  usePaneFlags('response', {
    hasDetails: Boolean(result.details?.items.length),
  })
  usePaneActions('response', {
    resend: (event) => {
      event.preventDefault()
      if (!pending) {
        onResend()
      }
    },
    details: () => setDetailsVisible((visible) => !visible),
  })

  return (
    <section id="response-pane" className="flex h-full min-h-0 min-w-0 flex-col" aria-live="polite">
      <div className="oc-bar flex flex-wrap items-center gap-3 px-3 py-2 md:px-4">
        {result.status ? (
          <p className="font-mono text-xs tabular-nums text-ink">
            {result.status.code !== undefined ? `${result.status.code} ` : ''}
            {result.status.text}
          </p>
        ) : null}
        <p className="font-mono text-xs text-faint">
          {new Intl.NumberFormat(undefined, {
            maximumFractionDigits: 0,
          }).format(result.elapsedMs)}
          &nbsp;ms
        </p>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            className={paneBarButtonClass}
            onClick={onBack}
          >
            Edit input
            <KeyHints>
              <Kbd hotkey="Escape" />
            </KeyHints>
          </button>
          <button
            type="button"
            className="exec-solid inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium disabled:bg-faint"
            disabled={pending}
            onClick={onResend}
          >
            {pending ? executingLabel : executeLabel}
            <KeyHints>
              <Kbd hotkey="Mod+Enter" />
            </KeyHints>
          </button>
        </div>
      </div>

      {error ? (
        <p className="oc-bar px-3 py-2 text-xs text-signal md:px-4" role="alert">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 md:px-4">
        {result.inputRequired && onContinue ? (
          <section className="mb-3 bg-ink/5 px-3 py-3">
            <p className="text-sm text-ink">The server needs additional client input.</p>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-xs text-mute">
              {JSON.stringify(result.inputRequired.requests, null, 2)}
            </pre>
            <label className="mt-3 block">
              <span className="text-xs text-mute">Input responses (JSON)</span>
              <textarea
                className="mt-1 min-h-32 w-full resize-y bg-paper px-2 py-2 font-mono text-xs text-ink outline-none focus:bg-ink/5"
                value={inputResponses}
                onChange={(event) => setInputResponses(event.target.value)}
              />
            </label>
            {inputError ? (
              <p className="mt-2 text-xs text-error" role="alert">
                {inputError}
              </p>
            ) : null}
            <button
              type="button"
              className="exec-solid mt-2 px-3 py-1.5 text-sm font-medium"
              disabled={pending}
              onClick={() => {
                try {
                  const parsed = JSON.parse(inputResponses) as unknown
                  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new Error('Responses must be a JSON object.')
                  }
                  setInputError(undefined)
                  onContinue(parsed as Record<string, unknown>)
                } catch (nextError) {
                  setInputError(
                    nextError instanceof Error ? nextError.message : 'Enter valid JSON.',
                  )
                }
              }}
            >
              {pending ? executingLabel : 'Continue'}
            </button>
          </section>
        ) : null}

        {result.details && result.details.items.length > 0 ? (
          <div className="mb-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 font-mono text-xs text-mute hover:text-ink"
              aria-expanded={detailsVisible}
              onClick={() => setDetailsVisible((visible) => !visible)}
            >
              {detailsVisible ? '▾' : '▸'} {result.details.label} (
              {result.details.items.length})
              <Kbd hotkey="H" />
            </button>
            {detailsVisible ? (
              <dl className="mt-2 space-y-1 bg-ink/5 px-3 py-2">
                {result.details.items.map((item) => (
                  <div key={`${item.name}:${item.value}`}>
                    <dt className="font-mono text-[11px] text-faint">{item.name}</dt>
                    <dd className="break-words font-mono text-xs">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}

        <JsonView text={result.body} pane="response" />
      </div>
    </section>
  )
}

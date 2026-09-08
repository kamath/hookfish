import { useEffect, useState } from 'react'
import { copyText } from '../lib/clipboard'
import { GITHUB_REPO_URL } from './github-link'
import { homepageLaunchHint, type LocalRuntime } from '../lib/runtime'

export const LOCAL_LAUNCH_COMMAND = 'npx hookfish up'
export const LOCAL_LAUNCH_COPIED = 'copied to clipboard'

function LaunchCommandCopy() {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <button
      type="button"
      aria-label={`Copy ${LOCAL_LAUNCH_COMMAND}`}
      aria-live="polite"
      className="inline-flex items-center bg-ink/5 px-1.5 py-0.5 font-mono outline-none hover:bg-ink/10 focus-visible:bg-ink/10"
      onFocus={(event) => event.stopPropagation()}
      onClick={() => {
        void copyText(LOCAL_LAUNCH_COMMAND).then((ok) => {
          if (ok) {
            setCopied(true)
          }
        })
      }}
    >
      {copied ? LOCAL_LAUNCH_COPIED : LOCAL_LAUNCH_COMMAND}
    </button>
  )
}

export function HomepageLaunchHint({
  location,
  runtime,
}: {
  location?: { hostname: string; port: string; protocol: string }
  runtime?: LocalRuntime | null
}) {
  const hint = homepageLaunchHint(
    location ??
      (typeof window === 'undefined'
        ? { hostname: '', port: '', protocol: 'http:' }
        : window.location),
    runtime,
  )

  if (hint.kind === 'local') {
    return (
      <p className="mt-2 text-center text-sm text-mute">
        Running locally on port {hint.port}
      </p>
    )
  }

  return (
    <p className="mt-2 text-center text-sm text-mute">
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-signal underline underline-offset-2"
        onFocus={(event) => event.stopPropagation()}
      >
        Run it yourself
      </a>
      {': '}
      <LaunchCommandCopy />
    </p>
  )
}

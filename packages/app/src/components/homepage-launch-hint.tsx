import { GITHUB_REPO_URL } from './github-link'
import { homepageLaunchHint, type LocalRuntime } from '../lib/runtime'

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
      <code className="font-mono">npx hookfish up</code>
    </p>
  )
}

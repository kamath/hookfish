import { GITHUB_REPO_URL } from './github-link'
import { homepageLaunchHint } from '../lib/runtime'

export function HomepageLaunchHint({
  location,
}: {
  location?: { hostname: string; port: string; protocol: string }
}) {
  const hint = homepageLaunchHint(
    location ??
      (typeof window === 'undefined'
        ? { hostname: '', port: '', protocol: 'http:' }
        : window.location),
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

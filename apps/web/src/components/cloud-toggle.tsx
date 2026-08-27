import { useCloudProxy } from '../lib/cloud'

export function CloudToggle() {
  const [cloudProxy, setCloudProxy] = useCloudProxy()

  return (
    <div className="flex min-w-0 items-center">
      {cloudProxy ? null : (
        <p
          className="mr-1 flex h-8 w-max max-w-full shrink items-center overflow-hidden bg-error/10 px-2 text-[11px] leading-none text-error"
          role="status"
        >
          <span className="truncate">
            <span className="font-medium">Browser mode.</span> Remote hosts
            may block you with{' '}
            <a
              href="https://www.google.com/search?q=what+is+cors"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-2"
            >
              CORS
            </a>
            .
          </span>
        </p>
      )}
      <button
        type="button"
        className="inline-flex size-8 shrink-0 items-center justify-center text-mute outline-none hover:bg-ink/10 hover:text-ink focus-visible:bg-ink/10 focus-visible:text-ink"
        aria-label={cloudProxy ? 'Switch to browser mode' : 'Turn on cloud proxy'}
        aria-pressed={cloudProxy}
        title={
          cloudProxy
            ? 'Cloud proxy on. Click to run in browser mode.'
            : 'Browser mode. Click to use the cloud proxy.'
        }
        onClick={() => setCloudProxy(!cloudProxy)}
      >
        <CloudIcon disabled={!cloudProxy} />
      </button>
    </div>
  )
}

function CloudIcon({ disabled }: { disabled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 18h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.2 8.7 4.7 4.7 0 0 0 7 18Z" />
      {disabled ? <path d="m4 4 16 16" /> : null}
    </svg>
  )
}

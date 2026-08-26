import handler from '@tanstack/react-start/server-entry'

export { UserVault } from './lib/vault.do'

export default {
  fetch: handler.fetch,
}

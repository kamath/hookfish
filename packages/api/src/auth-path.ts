export function authBasePathForMount(basePath: string) {
  return `${basePath.replace(/\/$/, '')}/auth`
}

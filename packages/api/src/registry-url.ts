export type RegistryUrlRejection =
  | 'invalid-url'
  | 'non-https-url'
  | 'non-public-url'
  | 'credential-bearing-url'

export type RegistryUrlResult =
  | { eligible: true; sourceUrl: string }
  | { eligible: false; reason: RegistryUrlRejection }

const NON_PUBLIC_HOSTNAMES = new Set(['localhost', 'localhost.localdomain'])
const NON_PUBLIC_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home.arpa',
  '.test',
  '.example',
  '.invalid',
]

function ipv4Parts(hostname: string) {
  const parts = hostname.split('.')
  if (
    parts.length !== 4 ||
    parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)
  ) {
    return undefined
  }
  return parts.map(Number)
}

function isPublicIpv4(hostname: string) {
  const parts = ipv4Parts(hostname)
  if (!parts) {
    return undefined
  }
  const [a = 0, b = 0, c = 0] = parts
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

function isPublicHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  if (
    !normalized ||
    NON_PUBLIC_HOSTNAMES.has(normalized) ||
    NON_PUBLIC_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  ) {
    return false
  }
  // Literal IPv6 addresses are rejected conservatively. Public hosts using
  // IPv6 through DNS remain valid and are subject to the deployment's egress policy.
  if (normalized.startsWith('[') || normalized.includes(':')) {
    return false
  }
  const publicIpv4 = isPublicIpv4(normalized)
  if (publicIpv4 !== undefined) {
    return publicIpv4
  }
  return normalized.includes('.')
}

export function registryUrl(value: string): RegistryUrlResult {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { eligible: false, reason: 'invalid-url' }
  }
  if (url.protocol !== 'https:') {
    return { eligible: false, reason: 'non-https-url' }
  }
  if (url.username || url.password || url.search || url.hash) {
    return { eligible: false, reason: 'credential-bearing-url' }
  }
  if (!isPublicHostname(url.hostname)) {
    return { eligible: false, reason: 'non-public-url' }
  }
  return { eligible: true, sourceUrl: url.toString() }
}

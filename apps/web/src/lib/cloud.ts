import { atom, useAtomValue } from 'jotai'
import { store } from './chrome'

const CLOUD_PROXY_KEY = 'oc:cloud-proxy'

export const cloudProxyAtom = atom(true)

export function getCloudProxy() {
  return store.get(cloudProxyAtom)
}

export function setCloudProxy(enabled: boolean) {
  store.set(cloudProxyAtom, enabled)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CLOUD_PROXY_KEY, String(enabled))
  }
}

export function hydrateCloudProxy() {
  if (typeof window !== 'undefined') {
    setCloudProxy(window.localStorage.getItem(CLOUD_PROXY_KEY) !== 'false')
  }
}

export function useCloudProxy() {
  return [useAtomValue(cloudProxyAtom), setCloudProxy] as const
}

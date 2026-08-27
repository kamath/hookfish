import { atom, useAtomValue } from 'jotai'
import { store } from './chrome'

export const ROUTE_VIEW_KEY = 'oc:route-view'
export const ROUTE_VIEWS = ['invoke', 'inspect'] as const

export type RouteView = (typeof ROUTE_VIEWS)[number]

export const routeViewAtom = atom<RouteView>('invoke')

export function isRouteView(value: unknown): value is RouteView {
  return value === 'invoke' || value === 'inspect'
}

export function readRouteView(raw: string | null | undefined): RouteView {
  return isRouteView(raw) ? raw : 'invoke'
}

export function getRouteView() {
  return store.get(routeViewAtom)
}

export function setRouteView(view: RouteView) {
  store.set(routeViewAtom, view)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ROUTE_VIEW_KEY, view)
  }
}

export function hydrateRouteView() {
  if (typeof window === 'undefined') {
    return
  }
  store.set(routeViewAtom, readRouteView(window.localStorage.getItem(ROUTE_VIEW_KEY)))
}

export function useRouteView() {
  return useAtomValue(routeViewAtom)
}

export function routeInspectValue(operation: {
  name: string
  summary?: string
  description?: string
  deprecated?: boolean
  binding: unknown
  outputSchema?: unknown
}) {
  const value: Record<string, unknown> = {
    name: operation.name,
  }
  if (operation.summary) {
    value.summary = operation.summary
  }
  if (operation.description) {
    value.description = operation.description
  }
  if (operation.deprecated) {
    value.deprecated = true
  }
  value.binding = operation.binding
  if (operation.outputSchema) {
    value.outputSchema = operation.outputSchema
  }
  return value
}

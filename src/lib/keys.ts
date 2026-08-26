import { useHotkeys } from '@tanstack/react-hotkeys'
import type { UseHotkeyDefinition } from '@tanstack/react-hotkeys'
import { useChrome, type Mode, type View } from './chrome'
import { useViewStep } from './keymap'

export { consumePointerIntent } from './keymap'
export { useViewActions, useViewFlags, useViewStep } from './keymap'

export function useStepKeys(view: View, step: (delta: number) => void, enabled = true) {
  useViewStep(view, step, enabled)
}

export function usePaneHotkeys(
  view: View,
  modes: readonly Mode[],
  hotkeys: UseHotkeyDefinition[],
) {
  const chrome = useChrome()
  useHotkeys(hotkeys, {
    enabled: modes.includes(chrome.mode) && chrome.view === view,
  })
}

export function useEditHotkeys(hotkeys: UseHotkeyDefinition[]) {
  const { mode } = useChrome()
  useHotkeys(hotkeys, {
    enabled: mode === 'edit',
    ignoreInputs: false,
  })
}

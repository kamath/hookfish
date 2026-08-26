import type { Pane } from './chrome'
import { usePaneStep } from './keymap'

export { consumePointerIntent } from './keymap'
export {
  paneConfig,
  useGlobalKeybindings,
  usePaneActions,
  usePaneFlags,
  usePaneStep,
} from './keymap'

export function useStepKeys(pane: Pane, step: (delta: number) => void, enabled = true) {
  usePaneStep(pane, step, enabled)
}

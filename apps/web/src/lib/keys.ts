import type { Pane } from './chrome'
import { usePaneStep } from './keymap'

export { consumePointerIntent } from './keymap'
export {
  activeKeybindingsAtom,
  paneConfig,
  sourceSubmitActionId,
  useGlobalKeybindings,
  usePaneActions,
  usePaneFlags,
  usePaneStep,
  useShowKeybindings,
} from './keymap'

export function useStepKeys(pane: Pane, step: (delta: number) => void, enabled = true) {
  usePaneStep(pane, step, enabled)
}

import type { Pane } from './chrome'
import { usePaneStep } from './keymap'

export { consumePointerIntent } from './keymap'
export {
  KEYBINDINGS_MEDIA,
  activeKeybindingsAtom,
  isEscapeLike,
  keybindingsEnabled,
  paneConfig,
  sourceSubmitActionId,
  useGlobalKeybindings,
  useKeybindingsEnabled,
  usePaneActions,
  usePaneFlags,
  usePaneStep,
  useShowKeybindings,
} from './keymap'

export function useStepKeys(pane: Pane, step: (delta: number) => void, enabled = true) {
  usePaneStep(pane, step, enabled)
}

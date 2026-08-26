/** Always hear the key, even after focus moved into a field. Decide in the callback. */
export const commandHotkey = {
  ignoreInputs: false,
  preventDefault: false,
  requireReset: true,
} as const

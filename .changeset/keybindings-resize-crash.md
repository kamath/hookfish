---
'@hookfish/app': patch
'hookfish': patch
---

Fix a crash when the window is resized across the 768px keybindings breakpoint. `useShowKeybindings` short-circuited past `useAtomValue`, so the hook count changed mid-render and React failed with "Cannot read properties of undefined (reading 'length')".

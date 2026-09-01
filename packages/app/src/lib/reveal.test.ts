import assert from 'node:assert/strict'
import { revealInList } from './reveal.ts'

function fakeElement(rect: { top: number; bottom: number }, scrollTop = 0) {
  return {
    getBoundingClientRect: () => rect,
    scrollTop,
  } as HTMLElement
}

{
  const row = fakeElement({ top: 100, bottom: 120 })
  const list = fakeElement({ top: 80, bottom: 400 }, 50)
  revealInList(row, list)
  assert.equal(list.scrollTop, 50)
}

{
  const row = fakeElement({ top: 40, bottom: 60 })
  const list = fakeElement({ top: 80, bottom: 400 }, 100)
  revealInList(row, list)
  assert.equal(list.scrollTop, 60)
}

{
  const row = fakeElement({ top: 390, bottom: 420 })
  const list = fakeElement({ top: 80, bottom: 400 }, 100)
  revealInList(row, list)
  assert.equal(list.scrollTop, 120)
}

revealInList(null, fakeElement({ top: 0, bottom: 100 }))
revealInList(fakeElement({ top: 0, bottom: 20 }), null)

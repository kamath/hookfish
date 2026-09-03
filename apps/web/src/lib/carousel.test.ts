import assert from 'node:assert/strict'
import {
  MAX_CAROUSEL_ITEMS,
  visibleCarouselItems,
  wrappedCarouselIndex,
} from './carousel'

const items = ['one', 'two', 'three', 'four', 'five', 'six', 'seven']

assert.equal(MAX_CAROUSEL_ITEMS, 5)
assert.deepEqual(visibleCarouselItems(items), items.slice(0, 5))
assert.deepEqual(items, ['one', 'two', 'three', 'four', 'five', 'six', 'seven'])

assert.equal(wrappedCarouselIndex(0, 1, 7), 1)
assert.equal(wrappedCarouselIndex(6, 1, 7), 0)
assert.equal(wrappedCarouselIndex(0, -1, 7), 6)
assert.equal(wrappedCarouselIndex(0, 1, 0), 0)

console.log('carousel limits and wrapping ok')

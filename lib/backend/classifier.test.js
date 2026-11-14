import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyLocal } from './classifier.js'

test('allows educational YouTube that matches the mission', () => {
  assert.equal(classifyLocal({ mission: 'Finish 3 calculus problems', url: 'https://www.youtube.com/watch?v=123', title: 'Calculus derivatives explained' }).decision, 'study')
})

test('pauses unrelated entertainment YouTube', () => {
  assert.equal(classifyLocal({ mission: 'Finish calculus problems', url: 'https://www.youtube.com/watch?v=456', title: 'Funny gaming compilation' }).decision, 'distracting')
  assert.equal(classifyLocal({ mission: 'Finish calculus problems', url: 'https://www.youtube.com/watch?v=food', title: 'I made the biggest sandwich - YouTube' }).decision, 'distracting')
  assert.equal(classifyLocal({ mission: 'Finish calculus problems', url: 'https://youtu.be/food', title: 'I made the biggest sandwich' }).decision, 'distracting')
})

test('leaves uncertain video unknown and obeys user overrides', () => {
  const input = { mission: 'Calculus', url: 'https://www.youtube.com/watch?v=789', title: 'New video' }
  assert.equal(classifyLocal(input).decision, 'unknown')
  assert.equal(classifyLocal({ ...input, title: 'History lecture - YouTube' }).decision, 'unknown')
  assert.equal(classifyLocal({ ...input, url: 'https://www.youtube.com/', title: 'YouTube' }).decision, 'unknown')
  assert.equal(classifyLocal({ ...input, alwaysAllow: ['youtube.com'] }).decision, 'study')
})

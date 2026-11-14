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

test('classifies common study and distracting sites without setup', () => {
  const mission = 'Finish 3 calculus problems'
  assert.equal(classifyLocal({ mission, url: 'https://www.khanacademy.org/math', title: 'Math' }).decision, 'study')
  assert.equal(classifyLocal({ mission, url: 'https://www.instagram.com/reels/', title: 'Instagram' }).decision, 'distracting')
  assert.equal(classifyLocal({ mission, url: 'https://www.reddit.com/r/calculus/', title: 'Calculus tutorial' }).decision, 'distracting')
  for (const url of ['https://www.tiktok.com/@someone', 'https://x.com/home', 'https://www.facebook.com/', 'https://www.snapchat.com/', 'https://www.pinterest.com/', 'https://www.linkedin.com/feed/', 'https://discord.com/channels/@me', 'https://web.whatsapp.com/', 'https://web.telegram.org/a/', 'https://www.threads.net/']) {
    assert.equal(classifyLocal({ mission, url, title: 'Social feed' }).decision, 'distracting', url)
  }
  assert.equal(classifyLocal({ mission, url: 'https://www.instagram.com/reels/', title: 'Instagram', alwaysAllow: ['instagram.com'] }).decision, 'study')
  assert.equal(classifyLocal({ mission, url: 'https://www.khanacademy.org/math', title: 'Math', alwaysPause: ['khanacademy.org'] }).decision, 'distracting')
  assert.equal(classifyLocal({ mission, url: 'https://example.com/', title: 'Example' }).decision, 'unknown')
})

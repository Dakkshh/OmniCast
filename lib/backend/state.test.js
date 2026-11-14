import test from 'node:test'
import assert from 'node:assert/strict'
import { initialState, settle, activity, timingFor } from './state.js'

test('counts study-tab and unrelated-page seconds by timestamp', () => {
  const studying = settle({ ...initialState, status: 'STUDYING', pageDecision: 'study', lastUpdatedAt: 1000 }, 6100)
  assert.equal(studying.studySeconds, 5)
  const distracted = settle({ ...studying, pageDecision: 'distracting' }, 9200)
  assert.equal(distracted.offTaskSeconds, 3)
  assert.equal(distracted.currentOffTaskSeconds, 3)
})

test('excludes breaks and browser-unfocused time', () => {
  assert.equal(settle({ ...initialState, status: 'BREAK', pageDecision: 'study', lastUpdatedAt: 1000 }, 6100).studySeconds, 0)
  assert.equal(settle({ ...initialState, status: 'STUDYING', pageDecision: 'study', browserFocused: false, lastUpdatedAt: 1000 }, 6100).studySeconds, 0)
})

test('counts only continuous observed comeback time', () => {
  const first = settle({ ...initialState, status: 'RECOVERING', pageDecision: 'study', lastUpdatedAt: 1000 }, 61_000)
  assert.equal(first.recoverySeconds, 60)
  const away = settle({ ...first, pageDecision: 'unknown', recoverySeconds: 0 }, 121_000)
  assert.equal(away.recoverySeconds, 0)
  const back = settle({ ...away, pageDecision: 'study' }, 181_000)
  assert.equal(back.recoverySeconds, 60)
})

test('closes each timeline segment on category change and session end', () => {
  const study = activity(initialState, 'study', 1000)
  const breakTime = activity(study, 'break', 6000)
  const ended = activity(breakTime, null, 9000)
  assert.deepEqual(ended.activityTimeline, [
    { category: 'study', startedAt: 1000, endedAt: 6000 },
    { category: 'break', startedAt: 6000, endedAt: 9000 },
  ])
})

test('labels accelerated demo timing separately from normal timing', () => {
  assert.deepEqual(timingFor(initialState), { graceMs: 30_000, cooldownMs: 120_000, recoverySeconds: 120 })
  assert.deepEqual(timingFor({ demoMode: true }), { graceMs: 5_000, cooldownMs: 10_000, recoverySeconds: 10 })
})

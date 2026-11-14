import test from 'node:test'
import assert from 'node:assert/strict'
import { notifyNudge, clearNudge } from './nudge.js'

test('notification failure leaves the recovery flow available', async () => {
  globalThis.chrome = { notifications: {
    create: async () => { throw Error('Notifications disabled') },
    clear: async () => { throw Error('Notifications disabled') },
  } }
  assert.equal(await notifyNudge({ mission: 'Finish 3 calculus problems' }), false)
  await assert.doesNotReject(clearNudge())
  delete globalThis.chrome
})

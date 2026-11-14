import test from 'node:test'
import assert from 'node:assert/strict'

test('live extension flow starts, classifies tabs, pauses, and returns', async () => {
  const handlers = {}
  const sent = []
  const scheduled = []
  const openTabs = new Map([
    [1, { id: 1, windowId: 1, active: true, title: 'Calculus notes', url: 'https://khanacademy.org/math/calculus' }],
    [2, { id: 2, windowId: 1, active: false, title: 'Funny gaming compilation', url: 'https://www.youtube.com/watch?v=fun' }],
    [3, { id: 3, windowId: 1, active: false, title: 'Calculus derivatives explained', url: 'https://www.youtube.com/watch?v=math' }],
  ])
  let saved
  let activeId = 1
  let focusedWindowId = 1
  let badge = ''
  let failNextShow = false
  let blockPauseDelivery = false
  const injected = []
  const notifications = []
  const clearedNotifications = []
  globalThis.chrome = {
    runtime: { onInstalled: { addListener: fn => { handlers.installed = fn } }, onStartup: { addListener: fn => { handlers.startup = fn } }, onMessage: { addListener: fn => { handlers.message = fn } } },
    action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async ({ text }) => { badge = text } },
    notifications: {
      create: async (id, options) => { notifications.push({ id, options }); return id },
      clear: async id => { clearedNotifications.push(id); return true },
      onClicked: { addListener: fn => { handlers.notificationClick = fn } },
      onButtonClicked: { addListener: fn => { handlers.notificationButton = fn } },
    },
    sidePanel: { setPanelBehavior: async () => {} },
    storage: { local: { get: async () => ({ studyBuddyState: saved }), set: async value => { saved = value.studyBuddyState } } },
    tabs: {
      query: async query => [...openTabs.values()].filter(tab => (!query.active || tab.id === activeId) && (query.windowId == null || tab.windowId === query.windowId)).map(tab => ({ ...tab, active: tab.id === activeId })),
      get: async id => { if (!openTabs.has(id)) throw Error('closed'); return { ...openTabs.get(id), active: id === activeId } },
      update: async id => { activeId = id; return openTabs.get(id) },
      create: async ({ url }) => { const tab = { id: 4, windowId: 1, url, title: 'Study page' }; openTabs.set(4, tab); activeId = 4; return tab },
      sendMessage: async (id, message) => {
        if (message.type === 'SHOW_PAUSE' && blockPauseDelivery) throw Error('No content script receiver')
        if (message.type === 'SHOW_PAUSE' && failNextShow) { failNextShow = false; throw Error('No content script receiver') }
        sent.push({ id, type: message.type })
        return { ok: true }
      },
      onActivated: { addListener: fn => { handlers.activated = fn } },
      onUpdated: { addListener: fn => { handlers.updated = fn } },
    },
    scripting: { executeScript: async ({ target, files }) => {
      if (files) { injected.push({ tabId: target.tabId, files }); if (blockPauseDelivery) throw Error('Cannot inject'); return [] }
      return [{ result: { title: openTabs.get(target.tabId).title, description: '', headings: '' } }]
    } },
    alarms: { clear: async () => {}, create: async (name, info) => { scheduled.push({ name, ...info }) }, onAlarm: { addListener: fn => { handlers.alarm = fn } } },
    windows: { WINDOW_ID_NONE: -1, getLastFocused: async () => ({ id: focusedWindowId }), update: async id => { focusedWindowId = id }, onFocusChanged: { addListener: fn => { handlers.focus = id => { focusedWindowId = id; return fn(id) } } } },
  }
  const { registerBackend } = await import('./service-worker.js')
  registerBackend()
  assert.equal(handlers.message({ type: 'SCREENSHOT' }, {}, () => {}), false)
  const send = message => new Promise(resolve => handlers.message(message, {}, resolve))
  await send({ type: 'UPDATE_SETUP', patch: { mission: 'Finish calculus problems', studyTab: 1 } })
  let state = await send({ type: 'START_SESSION' })
  assert.equal(state.pageDecision, 'study')
  assert.equal(state.view, 'active')
  assert.equal(badge, 'ON')
  const widget = await send({ type: 'GET_WIDGET_STATE' })
  assert.equal(widget.mission, 'Finish calculus problems')
  assert.equal(widget.studyUrl, undefined)
  assert.equal(widget.tabs, undefined)

  activeId = 2
  handlers.activated({ tabId: 2, windowId: 1 })
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.pageDecision, 'distracting')
  assert.equal(state.status, 'GRACE_PERIOD')
  assert.equal(state.distractionEpisodes, 1)
  const firstDeadline = state.graceDeadline
  const scheduledBeforeRestart = scheduled.length
  handlers.startup()
  await send({ type: 'GET_STATE' })
  assert.ok(scheduled.length > scheduledBeforeRestart)
  openTabs.get(2).title = 'Funny gaming compilation part 2'
  handlers.updated(2, { title: openTabs.get(2).title }, { ...openTabs.get(2), active: true })
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.distractionEpisodes, 1)
  assert.equal(state.graceDeadline, firstDeadline)
  handlers.updated(2, { status: 'complete' }, { ...openTabs.get(2), active: true })
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.graceDeadline, firstDeadline)
  await handlers.focus(-1)
  saved.graceDeadline = Date.now() - 1
  handlers.alarm({ name: 'study-buddy-grace' })
  await send({ type: 'GET_STATE' })
  assert.equal(sent.filter(item => item.type === 'SHOW_PAUSE').length, 0)
  failNextShow = true
  await handlers.focus(1)
  await send({ type: 'GET_STATE' })
  assert.ok(sent.some(item => item.id === 2 && item.type === 'SHOW_PAUSE'))
  assert.ok(injected.some(item => item.tabId === 2 && item.files.includes('content-scripts/pause.js')))
  assert.equal(saved.status, 'DISTRACTED')
  assert.equal(saved.pauseDelivery, 'shown')
  assert.equal(notifications.length, 1)
  assert.match(notifications[0].options.message, /calculus/)
  const firstNudgeAt = saved.lastNudgeAt

  blockPauseDelivery = true
  openTabs.get(2).title = 'Funny gaming compilation reloaded'
  handlers.updated(2, { status: 'complete' }, { ...openTabs.get(2), active: true })
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.pauseDelivery, 'failed')
  blockPauseDelivery = false
  saved.lastPauseAttemptAt = Date.now() - 5001
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.pauseDelivery, 'shown')
  assert.equal(notifications.length, 1)

  state = await send({ type: 'DISMISS_PAUSE' })
  assert.equal(state.pauseDismissed, true)
  assert.equal(state.status, 'DISTRACTED')
  state = await send({ type: 'GET_STATE' })
  assert.equal(notifications.length, 1)

  state = await send({ type: 'RETURN_TO_STUDY' })
  assert.equal(activeId, 1)
  assert.equal(focusedWindowId, 1)
  assert.equal(state.successfulReturns, 1)
  assert.equal(state.status, 'RECOVERING')
  assert.ok(clearedNotifications.includes('study-buddy-return'))
  state = await send({ type: 'RETURN_TO_STUDY' })
  assert.equal(state.successfulReturns, 1)

  activeId = 2
  handlers.activated({ tabId: 2, windowId: 1 })
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.status, 'GRACE_PERIOD')
  assert.equal(state.currentOffTaskSeconds, 0)
  assert.ok(scheduled.at(-1).when >= firstNudgeAt + 120_000)
  saved.graceDeadline = Date.now() - 1
  const prompts = sent.filter(item => item.type === 'SHOW_PAUSE').length
  handlers.alarm({ name: 'study-buddy-grace' })
  await send({ type: 'GET_STATE' })
  assert.equal(sent.filter(item => item.type === 'SHOW_PAUSE').length, prompts)
  openTabs.get(1).url = 'https://example.com/other-page'
  state = await send({ type: 'RETURN_TO_STUDY' })
  assert.equal(activeId, 4)
  assert.equal(state.currentTab.url, 'https://khanacademy.org/math/calculus')
  assert.equal(state.successfulReturns, 2)
  saved.lastUpdatedAt = Date.now() - 121_000
  state = await send({ type: 'CHECKPOINT_CONFIRMED' })
  assert.equal(state.checkpointCount, 1)
  assert.equal(state.completedTaskCount, 0)
  assert.equal(state.xp, 25)
  assert.match((await send({ type: 'CHECKPOINT_CONFIRMED' })).error, /2 minutes/)
  assert.equal((await send({ type: 'GET_STATE' })).xp, 25)

  activeId = 3
  handlers.activated({ tabId: 3, windowId: 1 })
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.pageDecision, 'study')
  activeId = 2
  handlers.activated({ tabId: 2, windowId: 1 })
  await send({ type: 'GET_STATE' })
  activeId = 3
  handlers.activated({ tabId: 3, windowId: 1 })
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.status, 'RECOVERING')
  assert.equal(state.successfulReturns, 3)
  saved.lastUpdatedAt = Date.now() - 60_000
  state = await send({ type: 'GET_STATE' })
  assert.ok(state.recoverySeconds >= 60)
  handlers.focus(-1)
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.recoverySeconds, 0)
  handlers.focus(1)
  await send({ type: 'GET_STATE' })
  saved.lastUpdatedAt = Date.now() - 100_000
  assert.match((await send({ type: 'CHECKPOINT_CONFIRMED' })).error, /2 minutes/)
  assert.ok((await send({ type: 'GET_STATE' })).recoverySeconds < 120)
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 503 })
  await send({ type: 'UPDATE_SETUP', patch: { aiEnabled: true } })
  activeId = 2
  handlers.activated({ tabId: 2, windowId: 1 })
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.aiUnavailable, true)
  assert.equal(state.decisionSource, 'local')
  const offTaskBeforeBreak = state.offTaskSeconds
  state = await send({ type: 'BREAK_START' })
  assert.equal(state.status, 'BREAK')
  assert.equal(badge, 'II')
  saved.lastUpdatedAt = Date.now() - 30_000
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.offTaskSeconds, offTaskBeforeBreak)
  state = await send({ type: 'BREAK_RESUME' })
  assert.equal(state.status, 'GRACE_PERIOD')
  assert.equal(state.pageDecision, 'distracting')
  state = await send({ type: 'END_SESSION' })
  assert.equal(state.status, 'IDLE')
  assert.equal(badge, '')
  assert.equal(state.currentTab, null)
  assert.equal(state.checkpointCount, 1)
  assert.equal(state.xp, 25)
  assert.equal(state.successfulReturns, 3)
  const recapStudySeconds = state.studySeconds
  saved.lastUpdatedAt = Date.now() - 30_000
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.studySeconds, recapStudySeconds)
  state = await send({ type: 'CLEAR_STUDY_PAGE' })
  assert.equal(state.studyUrl, '')
  assert.equal(state.studyTab, null)
  assert.ok(state.activityTimeline.some(item => item.category === 'break' && item.endedAt))
  assert.ok(state.activityTimeline.every(item => item.endedAt != null))
  await send({ type: 'NEW_SESSION' })
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.xp, 0)
  assert.equal(state.checkpointCount, 0)
  await send({ type: 'UPDATE_SETUP', patch: { studyTab: 4, demoMode: true, aiEnabled: false } })
  state = await send({ type: 'START_SESSION' })
  assert.equal(state.status, 'GRACE_PERIOD')
  assert.ok(state.graceDeadline - Date.now() <= 5_000)
  saved.graceDeadline = Date.now() - 1
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.status, 'DISTRACTED')
  state = await send({ type: 'SNOOZE_PAUSE' })
  assert.equal(state.status, 'GRACE_PERIOD')
  assert.ok(state.graceDeadline - Date.now() > 290_000)
  const beforeSnoozeEnd = notifications.length
  state = await send({ type: 'GET_STATE' })
  assert.equal(notifications.length, beforeSnoozeEnd)
  saved.graceDeadline = Date.now() - 1
  saved.lastNudgeAt = Date.now() - 11_000
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.status, 'DISTRACTED')
  assert.equal(notifications.length, beforeSnoozeEnd + 1)
  handlers.notificationButton('study-buddy-return', 0)
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.status, 'RECOVERING')
  saved.lastUpdatedAt = Date.now() - 11_000
  state = await send({ type: 'CHECKPOINT_CONFIRMED' })
  assert.equal(state.xp, 25)
  assert.equal(state.checkpointCount, 1)
  const beforeRestart = state
  const restarted = await import('./service-worker.js?restart=1')
  restarted.registerBackend()
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.status, beforeRestart.status)
  assert.equal(state.xp, beforeRestart.xp)
  assert.equal(state.checkpointCount, beforeRestart.checkpointCount)
  openTabs.set(5, { id: 5, windowId: 2, title: 'Funny gaming compilation', url: 'https://www.youtube.com/watch?v=other' })
  activeId = 5
  handlers.activated({ tabId: 5, windowId: 2 })
  state = await send({ type: 'GET_STATE' })
  assert.notEqual(state.currentTab?.id, 5)
  await handlers.focus(2)
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.currentTab?.id, 5)
  assert.equal(state.pageDecision, 'distracting')
  openTabs.set(6, { id: 6, windowId: 2, title: 'New page', url: 'https://example.com/neutral' })
  openTabs.set(7, { id: 7, windowId: 2, title: 'Calculus derivatives explained', url: 'https://www.youtube.com/watch?v=math2' })
  activeId = 6
  handlers.activated({ tabId: 6, windowId: 2 })
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.pageDecision, 'unknown')
  state = await send({ type: 'PAUSE_CURRENT' })
  assert.equal(state.pageDecision, 'distracting')
  assert.equal(state.pauseDelivery, 'shown')
  assert.equal(state.decisionSource, 'you')
  handlers.updated(6, { status: 'complete' }, { ...openTabs.get(6), active: true })
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.pageDecision, 'distracting')
  activeId = 7
  handlers.activated({ tabId: 7, windowId: 2 })
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.status, 'RECOVERING')
  assert.equal(state.successfulReturns, 2)
  await send({ type: 'END_SESSION' })
  await send({ type: 'NEW_SESSION' })
  await send({ type: 'UPDATE_SETUP', patch: { studyTab: null } })
  activeId = 3
  state = await send({ type: 'START_SESSION' })
  assert.equal(state.studyTab, 3)
  assert.equal(state.status, 'STUDYING')
  openTabs.set(8, { id: 8, windowId: 2, active: true, title: 'Instagram', url: 'https://www.instagram.com/reels/' })
  activeId = 8
  handlers.activated({ tabId: 8, windowId: 2 })
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.pageDecision, 'distracting')
  assert.equal(state.status, 'GRACE_PERIOD')
  saved.graceDeadline = Date.now() - 1
  state = await send({ type: 'GET_STATE' })
  assert.equal(state.status, 'DISTRACTED')
  assert.equal(state.pauseDelivery, 'shown')
  assert.ok(sent.some(item => item.id === 8 && item.type === 'SHOW_PAUSE'))
  globalThis.fetch = originalFetch
  delete globalThis.chrome
})

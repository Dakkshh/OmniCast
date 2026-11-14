import { domainOf } from './classifier.js'
import { pageFacts, decide } from './page.js'
import { panelState } from './panel-data.js'
import { STORAGE_KEY, initialState, settle, event, activity, timingFor } from './state.js'
import { NOTIFICATION_ID, notifyNudge, clearNudge } from './nudge.js'

const ALARM = 'study-buddy-grace'
let queue = Promise.resolve()
const run = task => { const result = queue.then(task); queue = result.catch(() => {}); return result }

async function read() { const saved = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY]; return settle({ ...initialState, ...saved, allowedPages: saved?.allowedPages || [], pausedPages: saved?.pausedPages || [] }) }
async function save(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state })
  try {
    await chrome.action.setBadgeBackgroundColor({ color: '#FFD23F' })
    await chrome.action.setBadgeText({ text: state.status === 'IDLE' ? '' : state.status === 'BREAK' ? 'II' : 'ON' })
  } catch {}
  return state
}
async function isLastFocusedWindow(windowId) {
  try { return (await chrome.windows.getLastFocused()).id === windowId }
  catch { return true }
}

async function overlay(tabId, show, state) {
  if (!tabId) return false
  const message = { type: show ? 'SHOW_PAUSE' : 'HIDE_PAUSE', mission: state.mission, reason: state.decisionReason, seconds: state.currentOffTaskSeconds }
  try {
    const response = await chrome.tabs.sendMessage(tabId, message)
    if (!show || response?.ok) return true
  }
  catch {
    if (!show) return false
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content-scripts/pause.js'] })
    return Boolean((await chrome.tabs.sendMessage(tabId, message))?.ok)
  } catch { return false }
}

async function scheduleNudge(state, now = Date.now()) {
  if (state.pauseDismissed || state.status === 'DISTRACTED' || !state.graceDeadline) return
  const when = Math.max(state.graceDeadline, (state.lastNudgeAt || 0) + timingFor(state).cooldownMs, now)
  await chrome.alarms.create(ALARM, { when })
}

async function showNudge(state, now = Date.now()) {
  if (state.pageDecision !== 'distracting' || !state.browserFocused || !state.graceDeadline || state.graceDeadline > now || state.pauseDismissed || state.status === 'BREAK' || state.status === 'DISTRACTED') return state
  if (state.lastNudgeAt && now - state.lastNudgeAt < timingFor(state).cooldownMs) { await scheduleNudge(state, now); return state }
  const next = await save({ ...state, status: 'DISTRACTED', lastNudgeAt: now })
  const delivered = await overlay(next.currentTab?.id, true, next)
  await notifyNudge(next)
  return save({ ...next, pauseDelivery: delivered ? 'shown' : 'failed', lastPauseAttemptAt: now })
}

async function evaluate(state, tabId) {
  if (['IDLE', 'BREAK'].includes(state.status)) return state
  let tab
  try { tab = await chrome.tabs.get(tabId) } catch { return state }
  if (!/^https?:/.test(tab.url || '')) {
    await chrome.alarms.clear(ALARM)
    await overlay(state.currentTab?.id, false, state)
    await clearNudge()
    return save(activity({ ...state, status: ['GRACE_PERIOD', 'DISTRACTED'].includes(state.status) ? 'STUDYING' : state.status, currentTab: null, pageDecision: 'unknown', graceDeadline: null, recoverySeconds: 0, pauseDelivery: '' }, 'unknown'))
  }
  const sameDistractingPage = state.pageDecision === 'distracting' && state.currentTab?.url === tab.url
  const previousStatus = state.status
  const previousGraceDeadline = state.graceDeadline
  const previousDismissed = state.pauseDismissed
  const previousEpisodes = state.distractionEpisodes
  const previousId = state.currentTab?.id
  if (previousId && previousId !== tabId) await overlay(previousId, false, state)
  await chrome.alarms.clear(ALARM)
  state = await save({ ...state, currentTab: { id: tab.id, title: tab.title || '', domain: domainOf(tab.url), url: tab.url }, pageDecision: 'analyzing', decisionReason: '', graceDeadline: null, pauseDismissed: false, pauseDelivery: '' })
  const result = await decide(state, tab, await pageFacts(tabId))
  const latest = await read()
  if (latest.currentTab?.id !== tabId || latest.currentTab?.url !== tab.url || ['IDLE', 'BREAK'].includes(latest.status)) return latest
  let next = { ...latest, currentTab: { id: tab.id, title: tab.title || '', domain: domainOf(tab.url), url: tab.url }, pageDecision: result.decision, decisionReason: result.reason, decisionSource: result.source, aiUnavailable: Boolean(result.aiUnavailable), graceDeadline: null }
  if (result.decision === 'distracting') {
    next = sameDistractingPage
      ? { ...next, status: previousStatus, distractionEpisodes: previousEpisodes, graceDeadline: previousGraceDeadline, pauseDismissed: previousDismissed }
      : event({ ...next, status: 'GRACE_PERIOD', distractionEpisodes: next.distractionEpisodes + 1, graceDeadline: Math.max(Date.now() + timingFor(next).graceMs, next.snoozedUntil || 0), currentOffTaskSeconds: 0, recoverySeconds: 0, recoveryRewarded: false }, 'Distracting page detected')
    await scheduleNudge(next)
  } else if (result.decision === 'study' && next.distractionEpisodes > next.lastRecoveredEpisode) {
    next = event({ ...next, status: 'RECOVERING', recoverySeconds: 0, recoveryRewarded: false, lastRecoveredEpisode: next.distractionEpisodes, successfulReturns: next.successfulReturns + 1 }, 'Returned to study page')
  } else if (result.decision === 'study' && ['GRACE_PERIOD', 'DISTRACTED'].includes(previousStatus)) {
    next = { ...next, status: 'STUDYING' }
  } else if (result.decision !== 'study' && previousStatus === 'RECOVERING') {
    next = { ...next, recoverySeconds: 0 }
  }
  next = activity(next, next.browserFocused ? result.decision : 'away')
  if (result.decision !== 'distracting') await clearNudge()
  if (result.decision === 'distracting' && next.status === 'DISTRACTED' && !next.pauseDismissed) {
    const delivered = await overlay(tabId, true, next)
    next = { ...next, pauseDelivery: delivered ? 'shown' : 'failed', lastPauseAttemptAt: Date.now() }
  } else if (result.decision !== 'distracting' || !sameDistractingPage) await overlay(tabId, false, next)
  return save(next)
}

async function handle(message, sender) {
  let state = await read()
  const now = Date.now()
  if (message.type === 'GET_STATE') {
    if (state.status === 'GRACE_PERIOD' && state.graceDeadline && state.graceDeadline <= now) state = await showNudge(state, now)
    if (state.status === 'DISTRACTED' && state.pauseDelivery === 'failed' && now - state.lastPauseAttemptAt >= 5000 && !state.pauseDismissed) {
      const delivered = await overlay(state.currentTab?.id, true, state)
      state = await save({ ...state, pauseDelivery: delivered ? 'shown' : 'failed', lastPauseAttemptAt: now })
    }
    return panelState(state)
  }
  if (message.type === 'CONTENT_READY') {
    if (state.currentTab?.id === sender.tab?.id && state.pageDecision === 'distracting' && !state.pauseDismissed) {
      if (state.status === 'DISTRACTED') {
        const delivered = await overlay(sender.tab.id, true, state)
        await save({ ...state, pauseDelivery: delivered ? 'shown' : 'failed', lastPauseAttemptAt: now })
      }
      else await showNudge(state, now)
    }
    return { ok: true }
  }
  if (message.type === 'PAGE_CHANGED') { if (sender.tab?.active && state.status !== 'IDLE' && await isLastFocusedWindow(sender.tab.windowId)) await evaluate(state, sender.tab.id); return { ok: true } }
  if (message.type === 'UPDATE_SETUP') { const keys = ['mission', 'target', 'duration', 'studyTab', 'aiEnabled', 'screenshotEnabled', 'demoMode', 'alwaysAllow', 'alwaysPause']; const patch = Object.fromEntries(Object.entries(message.patch || {}).filter(([key]) => keys.includes(key))); return panelState(await save({ ...state, ...patch })) }
  if (message.type === 'START_SESSION') {
    if (state.status !== 'IDLE') return panelState(state)
    if (!state.mission?.trim() || !state.studyTab) throw new Error('Choose a mission and study tab')
    if (!Number.isFinite(Number(state.duration)) || Number(state.duration) < 1 || Number(state.duration) > 240) throw new Error('Choose a study target from 1 to 240 minutes')
    if (state.target !== '' && state.target != null && (!Number.isInteger(Number(state.target)) || Number(state.target) < 1 || Number(state.target) > 99)) throw new Error('Choose 1 to 99 tasks, or leave the task target empty')
    const tab = await chrome.tabs.get(Number(state.studyTab))
    if (!/^https?:/.test(tab.url || '')) throw new Error('Choose an open study webpage')
    state = event({ ...state, view: 'active', status: 'STUDYING', studyUrl: tab.url, startedAt: now, endedAt: null, studySeconds: 0, offTaskSeconds: 0, currentOffTaskSeconds: 0, completedTaskCount: 0, checkpointCount: 0, xp: 0, distractionEpisodes: 0, successfulReturns: 0, lastRecoveredEpisode: 0, recoverySeconds: 0, recoveryRewarded: false, lastNudgeAt: null, snoozedUntil: 0, aiUnavailable: false, lastUpdatedAt: now, allowedPages: [], pausedPages: [], pauseDelivery: '', timeline: [], activityTimeline: [] }, 'Session started', now)
    await save(state)
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
    return panelState(await evaluate(state, active.id))
  }
  if (message.type === 'RETURN_TO_STUDY') {
    if (!state.studyUrl || state.status === 'IDLE') throw new Error('No active study page saved')
    if (state.pageDecision !== 'distracting') return panelState(state)
    let tab
    try {
      tab = await chrome.tabs.get(Number(state.studyTab))
      if (tab.url !== state.studyUrl) throw new Error('Study tab moved')
      await chrome.tabs.update(tab.id, { active: true })
    }
    catch { tab = await chrome.tabs.create({ url: state.studyUrl, active: true }) }
    if (tab.windowId != null) { try { await chrome.windows.update(tab.windowId, { focused: true }) } catch {} }
    await overlay(state.currentTab?.id, false, state)
    await clearNudge()
    state = event({ ...state, status: 'RECOVERING', studyTab: tab.id, currentTab: { id: tab.id, title: tab.title || '', domain: domainOf(tab.url), url: tab.url }, pageDecision: 'study', graceDeadline: null, currentOffTaskSeconds: 0, recoverySeconds: 0, recoveryRewarded: false, pauseDelivery: '', lastRecoveredEpisode: state.distractionEpisodes, successfulReturns: state.successfulReturns + (state.distractionEpisodes > state.lastRecoveredEpisode ? 1 : 0) }, 'Returned to study page', now)
    await chrome.alarms.clear(ALARM)
    return panelState(await save(activity(state, 'study', now)))
  }
  if (message.type === 'ALLOW_CURRENT') {
    if (!state.currentTab?.url) return panelState(state)
    state = event({ ...state, status: ['GRACE_PERIOD', 'DISTRACTED'].includes(state.status) ? 'STUDYING' : state.status, allowedPages: [...new Set([...state.allowedPages, state.currentTab.url])], pausedPages: state.pausedPages.filter(url => url !== state.currentTab.url), pageDecision: 'study', pauseDismissed: false, graceDeadline: null, pauseDelivery: '', lastRecoveredEpisode: state.distractionEpisodes }, 'Marked page for studying', now)
    await chrome.alarms.clear(ALARM); await overlay(state.currentTab.id, false, state)
    await clearNudge()
    return panelState(await save(activity(state, 'study', now)))
  }
  if (message.type === 'PAUSE_CURRENT') {
    if (['IDLE', 'BREAK'].includes(state.status) || !state.currentTab?.url || state.currentTab.url === state.studyUrl) throw new Error('Open an unrelated page during a study session first')
    state = event({ ...state, pausedPages: [...new Set([...state.pausedPages, state.currentTab.url])], allowedPages: state.allowedPages.filter(url => url !== state.currentTab.url), pageDecision: 'distracting', decisionReason: 'You chose to pause this page.', decisionSource: 'you', status: 'GRACE_PERIOD', graceDeadline: now, lastNudgeAt: null, recoverySeconds: 0, pauseDismissed: false, distractionEpisodes: state.distractionEpisodes + (state.pageDecision === 'distracting' ? 0 : 1) }, 'Page paused by you', now)
    return panelState(await showNudge(await save(state), now))
  }
  if (message.type === 'SNOOZE_PAUSE') {
    if (state.pageDecision !== 'distracting' || ['IDLE', 'BREAK'].includes(state.status)) return panelState(state)
    state = event({ ...state, status: 'GRACE_PERIOD', graceDeadline: now + 300_000, snoozedUntil: now + 300_000, pauseDelivery: '', pauseDismissed: false }, 'Snoozed for 5 minutes', now)
    await overlay(state.currentTab?.id, false, state); await clearNudge(); await scheduleNudge(state, now)
    return panelState(await save(state))
  }
  if (message.type === 'DISMISS_PAUSE') { state = { ...state, pauseDismissed: true, pauseDelivery: '', status: state.pageDecision === 'distracting' ? 'DISTRACTED' : state.status }; await chrome.alarms.clear(ALARM); await overlay(state.currentTab?.id, false, state); await clearNudge(); return panelState(await save(state)) }
  if (message.type === 'BREAK_START') { state = event({ ...state, status: 'BREAK', graceDeadline: null, recoverySeconds: 0, pauseDelivery: '' }, 'Break started', now); await chrome.alarms.clear(ALARM); await overlay(state.currentTab?.id, false, state); await clearNudge(); return panelState(await save(activity(state, 'break', now))) }
  if (message.type === 'BREAK_RESUME') { state = event({ ...state, status: 'STUDYING', pageDecision: 'unknown', currentTab: null, pauseDismissed: false }, 'Break ended', now); await save(state); const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); return panelState(await evaluate(state, tab.id)) }
  if (message.type === 'TASK_CONFIRMED') { if (['IDLE', 'BREAK'].includes(state.status)) throw new Error('Resume your session to confirm a task'); state = event({ ...state, completedTaskCount: state.completedTaskCount + 1, xp: state.xp + 10 }, 'Task confirmed', now); return panelState(await save(state)) }
  if (message.type === 'CHECKPOINT_CONFIRMED') { if (state.status !== 'RECOVERING' || state.pageDecision !== 'study' || state.recoveryRewarded || state.recoverySeconds < timingFor(state).recoverySeconds) throw new Error(`Study on your saved page for ${state.demoMode ? '10 seconds' : '2 minutes'} first`); state = event({ ...state, status: 'STUDYING', recoveryRewarded: true, checkpointCount: state.checkpointCount + 1, xp: state.xp + 25 }, 'Recovery checkpoint · +25 XP', now); return panelState(await save(state)) }
  if (message.type === 'END_SESSION') { const previousId = state.currentTab?.id; state = event({ ...state, view: 'summary', status: 'IDLE', endedAt: now, graceDeadline: null, currentTab: null, pageDecision: 'unknown', decisionReason: '', allowedPages: [], pausedPages: [], pauseDelivery: '', snoozedUntil: 0 }, 'Session ended', now); await chrome.alarms.clear(ALARM); await overlay(previousId, false, state); await clearNudge(); return panelState(await save(activity(state, null, now))) }
  if (message.type === 'CLEAR_STUDY_PAGE' && state.status === 'IDLE') return panelState(await save({ ...state, studyTab: null, studyUrl: '' }))
  if (message.type === 'NEW_SESSION') return panelState(await save({ ...initialState, mission: state.mission, target: state.target, duration: state.duration, alwaysAllow: state.alwaysAllow, alwaysPause: state.alwaysPause, aiEnabled: state.aiEnabled, screenshotEnabled: state.screenshotEnabled, demoMode: state.demoMode }))
  return panelState(state)
}

export function registerBackend() {
chrome.runtime.onInstalled.addListener(async () => { await save(await read()) })
chrome.runtime.onStartup.addListener(() => { run(async () => { const state = await save(await read()); if (state.status === 'GRACE_PERIOD') await scheduleNudge(state) }) })
chrome.runtime.onMessage.addListener((message, sender, respond) => { run(() => handle(message, sender)).then(respond, error => respond({ error: error.message })); return true })
chrome.tabs.onActivated.addListener(info => { run(async () => { const state = await read(); if (state.status !== 'IDLE' && await isLastFocusedWindow(info.windowId)) await evaluate(state, info.tabId) }) })
chrome.tabs.onUpdated.addListener((tabId, change, tab) => { if (!change.url && !change.title && change.status !== 'complete') return; run(async () => { const state = await read(); if (state.status !== 'IDLE' && tab.active && await isLastFocusedWindow(tab.windowId) && (change.status === 'complete' || state.currentTab?.url !== tab.url || (change.title && state.currentTab?.title !== tab.title))) await evaluate(state, tabId) }) })
chrome.windows.onFocusChanged.addListener(windowId => run(async () => {
  let state = await read()
  const focused = windowId !== chrome.windows.WINDOW_ID_NONE
  const category = state.status === 'BREAK' ? 'break' : focused ? state.pageDecision : 'away'
  state = await save(activity({ ...state, browserFocused: focused, recoverySeconds: focused ? state.recoverySeconds : 0 }, category))
  if (focused && state.status !== 'IDLE' && state.status !== 'BREAK') {
    const [tab] = await chrome.tabs.query({ active: true, windowId })
    if (tab) state = await evaluate(state, tab.id)
    if (state.status === 'GRACE_PERIOD' && state.graceDeadline && state.graceDeadline <= Date.now()) await showNudge(state)
  }
}))
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name !== ALARM) return; run(async () => { await showNudge(await read()) }) })
chrome.notifications.onClicked.addListener(id => { if (id === NOTIFICATION_ID) run(() => handle({ type: 'RETURN_TO_STUDY' }, {})) })
chrome.notifications.onButtonClicked.addListener((id, index) => { if (id === NOTIFICATION_ID && index === 0) run(() => handle({ type: 'RETURN_TO_STUDY' }, {})) })
}

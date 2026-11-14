export const STORAGE_KEY = 'studyBuddyState'
export const GRACE_MS = 30_000
export const NUDGE_COOLDOWN_MS = 120_000
export const RECOVERY_SECONDS = 120
export const timingFor = state => state.demoMode
  ? { graceMs: 5_000, cooldownMs: 10_000, recoverySeconds: 10 }
  : { graceMs: GRACE_MS, cooldownMs: NUDGE_COOLDOWN_MS, recoverySeconds: RECOVERY_SECONDS }

export const initialState = {
  view: 'setup', status: 'IDLE', mission: '', target: '', duration: 25,
  studyTab: null, studyUrl: '', aiEnabled: false, screenshotEnabled: false, demoMode: false, alwaysAllow: [], alwaysPause: [], allowedPages: [], pausedPages: [],
  currentTab: null, pageDecision: 'unknown', decisionReason: '', decisionSource: '', aiUnavailable: false, pauseDismissed: false, pauseDelivery: '', lastPauseAttemptAt: 0,
  studySeconds: 0, offTaskSeconds: 0, currentOffTaskSeconds: 0, completedTaskCount: 0, checkpointCount: 0, xp: 0, distractionEpisodes: 0,
  successfulReturns: 0, lastRecoveredEpisode: 0, recoverySeconds: 0, recoveryRewarded: false,
  startedAt: null, endedAt: null, lastUpdatedAt: null, graceDeadline: null, lastNudgeAt: null, snoozedUntil: 0,
  browserFocused: true, timeline: [], activityTimeline: [],
}

export function settle(state, now = Date.now()) {
  if (!state.lastUpdatedAt) return { ...state, lastUpdatedAt: now }
  const seconds = Math.max(0, Math.floor((now - state.lastUpdatedAt) / 1000))
  if (!seconds) return state
  const next = { ...state, lastUpdatedAt: state.lastUpdatedAt + seconds * 1000 }
  if (!state.browserFocused || ['IDLE', 'BREAK'].includes(state.status)) return next
  if (state.pageDecision === 'study') {
    next.studySeconds += seconds
    if (state.status === 'RECOVERING') next.recoverySeconds = (state.recoverySeconds || 0) + seconds
  }
  if (state.pageDecision === 'distracting') {
    next.offTaskSeconds += seconds
    next.currentOffTaskSeconds = (state.currentOffTaskSeconds || 0) + seconds
  }
  return next
}

export function event(state, label, now = Date.now()) {
  return { ...state, timeline: [...state.timeline.slice(-49), { label, at: now }] }
}

export function activity(state, category, now = Date.now()) {
  const items = [...(state.activityTimeline || [])]
  const last = items.at(-1)
  if (last?.category === category && last.endedAt == null) return state
  if (last?.endedAt == null) items[items.length - 1] = { ...last, endedAt: now }
  if (category) items.push({ category, startedAt: now, endedAt: null })
  return { ...state, activityTimeline: items.slice(-100) }
}

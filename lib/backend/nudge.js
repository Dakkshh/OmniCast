export const NOTIFICATION_ID = 'study-buddy-return'

export async function notifyNudge(state) {
  try {
    await chrome.notifications.create(NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: 'icon/128.png',
      title: 'Ready to return to study?',
      message: `Your mission: ${state.mission}`.slice(0, 180),
      buttons: [{ title: 'Return to Study' }],
      priority: 1,
    })
    return true
  } catch { return false }
}

export async function clearNudge() {
  try { await chrome.notifications.clear(NOTIFICATION_ID) } catch {}
}

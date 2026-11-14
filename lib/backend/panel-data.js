import { domainOf } from './classifier.js'

export async function panelState(state) {
  let studyTabClosed = false
  if (state.studyUrl && state.studyTab) {
    try { studyTabClosed = (await chrome.tabs.get(Number(state.studyTab))).url !== state.studyUrl }
    catch { studyTabClosed = true }
  }
  const tabs = (await chrome.tabs.query({ currentWindow: true }))
    .filter(tab => /^https?:/.test(tab.url || ''))
    .map(tab => ({ id: tab.id, title: tab.title || domainOf(tab.url), domain: domainOf(tab.url), url: tab.url, favIconUrl: tab.favIconUrl || '' }))
  return { ...state, tabs, studyTabClosed }
}

import { classifyLocal, domainOf } from './classifier.js'

const decisionCache = new Map()

export async function pageFacts(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: () => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      headings: [...document.querySelectorAll('h1,h2')].slice(0, 8).map(node => node.textContent?.trim()).filter(Boolean).join(' · ').slice(0, 1500),
    }) })
    return result?.result || {}
  } catch { return {} }
}

export async function decide(state, tab, facts) {
  const input = { mission: state.mission, url: tab.url, title: facts.title || tab.title || '', description: facts.description || '', studyUrl: state.studyUrl, alwaysAllow: state.alwaysAllow, alwaysPause: state.alwaysPause }
  if (state.allowedPages.includes(tab.url)) return { decision: 'study', reason: 'You marked this page for studying.', source: 'you' }
  if (state.pausedPages.includes(tab.url)) return { decision: 'distracting', reason: 'You chose to pause this page.', source: 'you' }
  const local = classifyLocal(input)
  if (local.reason.startsWith('You marked') || local.reason.startsWith('Your saved') || local.reason.startsWith('This site is usually')) return { ...local, source: 'rule' }
  if (!state.aiEnabled) return { ...local, source: 'local' }
  const cacheKey = `${state.mission}\n${tab.url}\n${input.title}\n${input.description}\n${facts.headings || ''}`
  const cached = decisionCache.get(cacheKey)
  if (!state.screenshotEnabled && cached && cached.expiresAt > Date.now()) return cached.result
  try {
    let image = ''
    if (state.screenshotEnabled && domainOf(tab.url).endsWith('youtube.com')) {
      try { image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 35 }) } catch {}
    }
    const response = await fetch('http://127.0.0.1:8788/classify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mission: state.mission, title: input.title, description: input.description, headings: facts.headings || '', domain: domainOf(tab.url), image }), signal: AbortSignal.timeout(11000) })
    if (response.ok) { const result = await response.json(); if (['study', 'distracting', 'unknown'].includes(result.decision)) { const chosen = result.decision === 'unknown' && local.decision !== 'unknown' ? { ...local, source: 'local' } : result; if (!state.screenshotEnabled) decisionCache.set(cacheKey, { result: chosen, expiresAt: Date.now() + 300_000 }); return chosen } }
  } catch {}
  return { ...local, source: 'local', aiUnavailable: true }
}

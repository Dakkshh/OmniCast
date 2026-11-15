(() => {
if (globalThis.__studyBuddyContentReady) return
globalThis.__studyBuddyContentReady = true

let host
let timer
let pausedVideos = []
const element = (tag, className, label = '') => {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = label
  return node
}

function hide(resume = false) { if (resume) resumeMedia(); host?.remove(); host = null; clearInterval(timer); pausedVideos = [] }
function resumeMedia() { for (const video of pausedVideos) video.play().catch(() => {}); pausedVideos = [] }

function show(message) {
  if (host) return
  hide()
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  pausedVideos = [...document.querySelectorAll('video')].filter(video => !video.paused)
  for (const video of pausedVideos) video.pause()
  host = document.createElement('div')
  host.id = 'study-buddy-pause'
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#F3EBDD;'
  const root = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = `
    *{box-sizing:border-box} .screen{position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:#F3EBDD;color:#141414;font-family:Arial,sans-serif}
    .card{width:min(100%,480px);padding:28px;background:#FFFDF8;border:3px solid #141414;box-shadow:6px 6px 0 #141414;transform:rotate(-1deg)}
    .eyebrow{font-size:12px;font-weight:900;letter-spacing:.08em}.title{font-size:32px;line-height:1.08;margin:16px 0;font-weight:900}.mission{padding:13px;background:#FFD23F;border:2px solid #141414;font-size:17px;font-weight:800}.reason{font-size:15px;line-height:1.5}.time{font-size:15px;font-weight:800;margin:18px 0}
    button{cursor:pointer;font:800 16px Arial,sans-serif;min-height:48px;border:2px solid #141414;box-shadow:4px 4px 0 #141414}.return{width:100%;background:#FF5A36}.row{display:flex;flex-wrap:wrap;gap:12px;margin-top:18px}.row button{flex:1 1 140px;background:#FFFDF8;font-size:14px;padding:8px}.row button:last-child{background:#FFD23F}button:hover{transform:translate(2px,2px);box-shadow:2px 2px 0 #141414}button:focus-visible{outline:3px solid #FF5A36;outline-offset:3px}
    @media(max-width:420px){.card{padding:20px}.row{flex-direction:column}.title{font-size:27px}}
    @media(prefers-reduced-motion:reduce){button{transition:none}}
  `
  const screen = element('div', 'screen')
  const card = element('div', 'card')
  const row = element('div', 'row')
  const mission = element('p', 'mission', message.mission || 'Your study mission')
  const explanation = element('p', 'reason explanation', message.reason || 'This page looks unrelated to your study goal.')
  const label = element('p', 'time')
  const error = element('p', 'reason')
  error.setAttribute('role', 'alert')
  const returnButton = element('button', 'return', 'Return to Study →')
  const allowButton = element('button', 'allow', 'This is for studying')
  const snoozeButton = element('button', 'snooze', 'Snooze 5 min')
  const continueButton = element('button', 'continue', 'Continue for now')
  row.append(allowButton, snoozeButton, continueButton)
  card.append(element('div', 'eyebrow', 'STUDY BUDDY · PAGE PAUSED'), element('h1', 'title', 'Ready to get back?'), element('p', 'reason', 'You were working on:'), mission, explanation, label, returnButton, row, error)
  screen.append(card)
  root.append(style, screen)
  let seconds = message.seconds || 0
  const updateTime = () => { label.textContent = `Time on this page: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }
  updateTime()
  timer = setInterval(() => { seconds++; updateTime() }, 1000)
  let pending = false
  async function act(type) {
    if (pending) return
    pending = true
    error.textContent = ''
    for (const button of [returnButton, allowButton, snoozeButton, continueButton]) button.disabled = true
    try {
      const result = await chrome.runtime.sendMessage({ type })
      if (!result) throw new Error('Study Buddy is not responding. Reload the extension.')
      if (result?.error) throw new Error(result.error)
    } catch (cause) { error.textContent = cause.message || 'Could not complete that action. Try again.' }
    finally {
      pending = false
      for (const button of [returnButton, allowButton, snoozeButton, continueButton]) button.disabled = false
    }
  }
  returnButton.addEventListener('click', () => { void act('RETURN_TO_STUDY') })
  allowButton.addEventListener('click', () => { void act('ALLOW_CURRENT') })
  snoozeButton.addEventListener('click', () => { void act('SNOOZE_PAUSE') })
  continueButton.addEventListener('click', () => { void act('DISMISS_PAUSE') })
  document.documentElement.append(host)
}

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === 'SHOW_PAUSE') { show(message); respond({ ok: true }) }
  if (message.type === 'HIDE_PAUSE') { hide(message.resume); respond({ ok: true }) }
})
document.addEventListener('play', event => { if (host && event.target instanceof HTMLMediaElement) event.target.pause() }, true)
chrome.runtime.sendMessage({ type: 'CONTENT_READY' }).catch(() => {})
document.addEventListener('yt-navigate-finish', () => chrome.runtime.sendMessage({ type: 'PAGE_CHANGED' }).catch(() => {}))
})()

const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'finish', 'study', 'work', 'some', 'three', 'into', 'about', 'problem', 'problems'])
const entertainment = /\b(funny|prank|gaming|gameplay|meme|reaction|celebrity|drama|compilation|shorts)\b/i
const learning = /\b(lesson|lecture|tutorial|explained|course|class|practice|exam|homework|derivative|integral|calculus|algebra|math|history|science|physics|chemistry)\b/i

export function domainOf(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase() } catch { return '' }
}

function domainMatches(domain, rule) { return domain === rule || domain.endsWith(`.${rule}`) }

export function classifyLocal({ mission = '', url = '', title = '', description = '', studyUrl = '', alwaysAllow = [], alwaysPause = [] }) {
  const domain = domainOf(url)
  if (!domain) return { decision: 'unknown', reason: 'This page cannot be checked.' }
  if (url === studyUrl) return { decision: 'study', reason: 'Your saved study page.' }
  if (alwaysAllow.some(rule => domainMatches(domain, rule))) return { decision: 'study', reason: 'You marked this site for studying.' }
  if (alwaysPause.some(rule => domainMatches(domain, rule))) return { decision: 'distracting', reason: 'You marked this site to pause.' }

  const words = mission.toLowerCase().match(/[a-z]{4,}/g)?.filter(word => !stopWords.has(word)) || []
  const pageText = `${title} ${description}`.toLowerCase()
  const matchesMission = words.some(word => pageText.includes(word))
  if (domainMatches(domain, 'youtube.com') || domainMatches(domain, 'youtu.be')) {
    if (matchesMission && learning.test(pageText)) return { decision: 'study', reason: 'This video matches your study goal.' }
    if (entertainment.test(pageText) && !matchesMission) return { decision: 'distracting', reason: 'This video looks unrelated to your study goal.' }
    const videoPage = domainMatches(domain, 'youtu.be') || /\/(watch|shorts|live)\b/.test(new URL(url).pathname)
    const videoTitle = title.replace(/\s*[-–]\s*YouTube\s*$/i, '').trim()
    if (videoPage && videoTitle && !/^(youtube|new video|video|watch|loading)$/i.test(videoTitle) && !learning.test(pageText) && !matchesMission) {
      return { decision: 'distracting', reason: 'This video does not look related to your study goal.' }
    }
    return { decision: 'unknown', reason: 'This video needs your decision.' }
  }
  if (matchesMission && learning.test(pageText)) return { decision: 'study', reason: 'This page matches your study goal.' }
  return { decision: 'unknown', reason: 'Not enough information to classify this page.' }
}

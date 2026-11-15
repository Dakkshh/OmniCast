import { askClaude } from '../lib/ai'

export default defineBackground(() => {

  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SCREENSHOT') {
      browser.tabs
        .captureVisibleTab({ format: 'jpeg', quality: 60 })
        .then((dataUrl) => askClaude(dataUrl, msg.task))        // wait for the screenshot, then call Claude
        .then((result) => sendResponse({ result }))   // wait for Claude, then reply
        .catch((err) => sendResponse({ error: String(err) }));
      return true;
    }
  });
});
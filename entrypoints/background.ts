import { registerBackend } from '../lib/backend/service-worker.js';
import { askClaude } from '../lib/ai';

export default defineBackground(() => {
  registerBackend();

  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'SCREENSHOT') {
      browser.tabs
        .captureVisibleTab({ format: 'jpeg', quality: 60 })
        .then((dataUrl) => askClaude(dataUrl, msg.task))
        .then((result) => sendResponse({ result }))
        .catch((err) => sendResponse({ error: String(err) }));
      return true;
    }
  });
});

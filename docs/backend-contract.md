# Study Buddy backend handoff

This branch adds the session engine to the WXT extension on `extension-frontend`. The existing popup and corner widget remain the frontend team's code. They need to send the messages below to drive sessions; the legacy `SCREENSHOT` widget request is not the session API.

## Frontend message contract

Send a message with `chrome.runtime.sendMessage({ type, patch? })`. Responses contain the current state plus `tabs` for setup. A response with `error` is a failed action. Subscribe to `chrome.storage.onChanged` for `studyBuddyState`, and call `GET_STATE` when opening the UI and once per second while it is visible to refresh elapsed time.

| Type | Purpose |
| --- | --- |
| `GET_STATE` | Read current session, selected tab, counters, decision, and setup tab list. |
| `UPDATE_SETUP` | Patch `mission`, `target`, `duration`, `studyTab`, `aiEnabled`, `screenshotEnabled`, `demoMode`, `alwaysAllow`, or `alwaysPause`. |
| `START_SESSION` | Start after mission and study tab are selected. |
| `RETURN_TO_STUDY` | Activate the saved tab or reopen its URL. |
| `ALLOW_CURRENT` / `PAUSE_CURRENT` | Correct the active page classification. |
| `SNOOZE_PAUSE` / `DISMISS_PAUSE` | Delay the prompt five minutes or dismiss it on this page. |
| `BREAK_START` / `BREAK_RESUME` | Stop and resume monitoring and study time. |
| `TASK_CONFIRMED` / `CHECKPOINT_CONFIRMED` | Award +10 task XP or eligible +25 comeback XP. |
| `END_SESSION` / `NEW_SESSION` | Show recap or reset for a new session. |
| `CLEAR_STUDY_PAGE` | Delete the saved study URL after ending. |

Example:

```ts
const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
await chrome.runtime.sendMessage({ type: 'UPDATE_SETUP', patch: {
  mission: 'Finish 3 calculus problems', studyTab: state.tabs[0].id, duration: 25,
} });
await chrome.runtime.sendMessage({ type: 'START_SESSION' });
```

The pause content script is injected on HTTP(S) pages and handles the page-covering recovery action. The service worker observes tab and window changes, stores timestamps in `chrome.storage.local`, schedules a grace alarm, and sends at most one notification per prompt. The extension does not monitor native apps or other Chrome profiles.

## OpenAI proxy

The API key stays in a local Node process, never in the extension bundle. Copy `.env.example` to `.env`, set `OPENAI_API_KEY`, and run `npm run server` on the demo machine. `http://127.0.0.1:8788/health` returns `ready: true` when a key is configured. Without the proxy or key, local classification rules remain active. Do not use `WXT_ANTHROPIC_API_KEY` or place any provider key in WXT build variables.

## Checks

Run `npm run compile`, `npm test`, and `npm run build`. The unpacked output is `.output/chrome-mv3/`. The popup and corner widget have not been replaced on this branch; the frontend team can connect their UI using this contract without merging our old Vite interface.

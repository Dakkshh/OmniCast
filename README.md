# Study Buddy Chrome extension

This branch combines the WXT Chrome extension and the latest `Study-Buddy-App-Version` website in one repository without changing either source branch.

## Chrome extension

From the repository root:

```bash
npm install
npm run compile
npm test
npm run build
```

Load `.output/chrome-mv3/` as an unpacked extension in Chrome. If it is already installed, click **Reload** on that extension's card at `chrome://extensions` after every build. Check that its loaded path is this repository's `.output/chrome-mv3/` folder; an older unpacked build will keep its old popup and behavior. Pin Study Buddy from Chrome's Extensions menu, then click its toolbar icon to open the session controls directly. The side panel has the same controls. Open a study webpage, enter a mission, and start. The current tab becomes the study page unless you choose another tab. The small on-page widget shows the current mission and observed study-tab time. Common social and streaming sites receive a pause screen after 30 seconds; educational videos matching the mission are allowed. Demo mode shortens the grace period to five seconds. If the icon still does nothing, check the extension card for errors and remove any older Study Buddy copy before loading this folder.

The OpenAI classifier is optional. To enable it, copy `.env.example` to `.env`, add an API key locally, and run `npm run server`. Keep keys out of the extension build. Local classification works without a key. The old Claude screenshot prototype is not called by this branch's extension UI.

## Friend's website

The latest website from `Study-Buddy-App-Version` is copied unchanged into `web/`:

```bash
npm --prefix web install
npm run build:web
npm run lint:web
```

The website is a standalone timer and **simulated** focus dashboard. Its focus buttons and score do not read the extension's session state. Use the extension for the live browser monitoring demo. The website can be presented separately as a concept or adapted later to consume shared session data.

## Branch safety

The extension fixes live on `fix/study-buddy-start-and-classification`. The `main`, `Study-Buddy-App-Version`, and `extension-frontend` branches are unchanged. Chrome extensions can observe and pause pages only in the Chrome profile where they are installed; native apps and other browsers are outside their reach.

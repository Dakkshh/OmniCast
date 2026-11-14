# Study Buddy integration branch

This branch combines the WXT Chrome extension and the latest `Study-Buddy-App-Version` website in one repository without changing either source branch.

## Chrome extension

From the repository root:

```bash
npm install
npm run compile
npm test
npm run build
```

Load `.output/chrome-mv3/` as an unpacked extension in Chrome. Click its toolbar icon, then **Open Study Buddy session** to open the side panel. Choose a study tab, enter a mission, and start. The side panel uses the real backend state; the small on-page widget shows the current mission and observed study-tab time. The pause screen appears on unrelated pages after the grace period. Demo mode shortens the grace period to five seconds.

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

This is `feature/study-buddy-integration`, based on `feature/study-buddy-backend`. The `main`, `Study-Buddy-App-Version`, and `extension-frontend` branches are unchanged. Review and test this branch before choosing a merge target.

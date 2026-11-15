# Study Buddy

AI-powered study focus tracker built at HackPrinceton 2026.

## Components

- website/ — React dashboard, study timer, webcam recording, and focus analytics
- extension/ — Chrome extension with Gemini-powered focus classification

## Run the website

cd website
npm install
npm run dev

## Build the Chrome extension

cd extension
npm install
npm run build

Load extension/.output/chrome-mv3 as an unpacked extension in Chrome.

The extension requires a local .env file containing WXT_GEMINI_API_KEY.
Never commit API keys.

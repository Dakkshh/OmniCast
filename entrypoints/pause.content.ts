export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    void import('../lib/backend/pause-content.js');
  },
});

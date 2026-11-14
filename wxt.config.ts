import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Study Buddy',
    description: 'A study recovery coach for Chrome tabs.',
    action: { default_title: 'Study Buddy' },
    permissions: ['storage', 'tabs', 'alarms', 'scripting', 'notifications'],
    host_permissions: ['<all_urls>'],
  },
});

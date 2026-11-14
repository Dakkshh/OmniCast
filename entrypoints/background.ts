import { registerBackend } from '../lib/backend/service-worker.js';

export default defineBackground(() => {
  registerBackend();
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.join(rootDir, 'src'),
    },
  },
  server: {
    proxy: {
      // В dev фронт ходит на тот же origin (/api), Vite проксирует на Nest — без CORS и без «висящих» запросов
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        timeout: 60_000,
        proxyTimeout: 60_000,
      },
    },
  },
});

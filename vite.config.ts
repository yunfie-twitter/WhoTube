import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['music.tsub4sa.xyz'], // ← カンマ追加
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/openapi.json': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
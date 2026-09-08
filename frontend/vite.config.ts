import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api/, /^\/admin/],
      },
      manifest: {
        name: 'MeyFu — Tarqatish va Sotuv',
        short_name: 'MeyFu',
        description: 'Distribution & Sales Management System',
        lang: 'uz',
        theme_color: '#4f46e5',
        background_color: '#f9fafb',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // jspdf faqat matn/rasm uchun ishlatiladi — `.html()` bog'liqliklarini stub qilamiz
      html2canvas: fileURLToPath(
        new URL('./src/shared/lib/emptyModule.ts', import.meta.url),
      ),
      dompurify: fileURLToPath(
        new URL('./src/shared/lib/emptyModule.ts', import.meta.url),
      ),
      canvg: fileURLToPath(
        new URL('./src/shared/lib/emptyModule.ts', import.meta.url),
      ),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          offline: ['dexie', 'dexie-react-hooks'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});

import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';
import { fileURLToPath, URL } from 'node:url';

const rawPort = process.env.PORT || '5173';

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || '/';

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig(async () => {
  return {
    base: basePath,
    plugins: [
      react(),
      runtimeErrorOverlay(),
      ...(process.env.NODE_ENV !== 'production' &&
      process.env.REPL_ID !== undefined
        ? [
            await import('@replit/vite-plugin-cartographer').then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, '..'),
              }),
            ),
            await import('@replit/vite-plugin-dev-banner').then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],
          navigateFallbackDenylist: [/^\/api/],
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
        '@assets': path.resolve(
          import.meta.dirname,
          '..',
          '..',
          'attached_assets',
        ),
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
    root: path.resolve(import.meta.dirname),
    build: {
      target: 'esnext',
      outDir: path.resolve(import.meta.dirname, 'dist/public'),
      emptyOutDir: true,
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
      port,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      fs: {
        strict: true,
      },
      proxy: {
        '/api': {
          target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
          changeOrigin: true,
        },
        '/ws': {
          target: process.env.VITE_PROXY_TARGET ?? 'ws://localhost:8000',
          ws: true,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});

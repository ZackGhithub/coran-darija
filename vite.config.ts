import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Sur GitHub Pages le site vit sous /<dépôt>/ : le workflow fournit BASE_PATH ; en local, la racine suffit.
const base = process.env.BASE_PATH ?? '/';

// Numéro de version affiché en bas de page : permet de vérifier quelle version tourne réellement (cache de l'app installée).
const sha = (process.env.GITHUB_SHA ?? (() => { try { return execSync('git rev-parse HEAD').toString(); } catch { return 'local'; } })()).trim().slice(0, 7);
const buildId = `${sha} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;

export default defineConfig({
  base,
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Coran Darija — Apprentissage et mémorisation',
        short_name: 'Coran Darija',
        description: 'Lire, réciter et mémoriser le Coran grâce aux passerelles du Darija.',
        lang: 'fr',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#0d1513',
        theme_color: '#0f766e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout le texte du Coran (~3 Mo) est préchargé : lecture complète hors ligne dès la première visite.
        globPatterns: ['**/*.{js,css,html,png,woff2,json}'],
        // Les horodatages des mots (~5 Mo pour 7 récitateurs) et les couleurs du Tajwid (~0,8 Mo) ne sont PAS préchargés : téléchargés à la demande, puis gardés.
        globIgnores: ['data/timing/**', 'data/tajweed/**'],
        navigateFallback: `${base}index.html`,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.includes('/data/timing/'),
            handler: 'CacheFirst',
            options: { cacheName: 'timings', expiration: { maxEntries: 400 } },
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.includes('/data/tajweed/'),
            handler: 'CacheFirst',
            options: { cacheName: 'tajweed', expiration: { maxEntries: 130 } },
          },
          {
            // Audio lu par notre propre code (fetch) : gardé pour le hors-ligne. On exclut les requêtes de l'élément <audio>
            // (destination « audio », par tranches d'octets) : y répondre depuis le cache casserait la lecture sur Safari.
            urlPattern: ({ url, request }: { url: URL; request: Request }) => url.origin === 'https://everyayah.com' && request.destination !== 'audio',
            handler: 'CacheFirst',
            options: { cacheName: 'audio-versets', expiration: { maxEntries: 300 }, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
});

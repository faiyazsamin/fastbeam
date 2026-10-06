import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// Dev server port is fixed at 5179 (project convention).
const PORT = 5179

export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    preact(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/favicon.svg', 'icons/favicon-32.png', 'icons/apple-touch-icon-180.png'],
      manifest: {
        id: '/',
        name: 'fastbeam',
        short_name: 'fastbeam',
        description: 'Files to the next device, straight across. No app, no account, no cloud.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0B7F80',
        background_color: '#F3F7F7',
        lang: 'en',
        categories: ['utilities', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Precache the shell plus the latin font subsets only; other unicode ranges load on demand.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}', '**/*latin*.woff2'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: PORT, strictPort: true, host: true },
  preview: { port: PORT, strictPort: true },
  build: { target: 'es2022', sourcemap: false },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})

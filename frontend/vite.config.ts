import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // strategies: 'injectManifest' = משתמשים ב-sw.js שלנו ב-public/ (לא generateSW)
      // זה הכרחי כדי שנוכל לטפל ב-push events בעצמנו
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectRegister: 'auto',
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
        'trophy.png',
      ],
      manifest: false, // משתמשים ב-public/manifest.json הסטטי שלנו
      devOptions: {
        // ב-dev: מאפשרים sw + manifest כדי שנוכל לבדוק התקנה ב-localhost
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
})

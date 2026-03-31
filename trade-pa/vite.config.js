import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['trade-pa-logo.png', 'favicon.ico'],
      manifest: {
        name: 'Trade PA',
        short_name: 'Trade PA',
        description: 'Your AI-powered trade business assistant',
        theme_color: '#f59e0b',
        background_color: '#0f0f0f',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'trade-pa-logo.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'trade-pa-logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Cache the app shell and key assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Cache API calls for offline resilience
        runtimeCaching: [
          {
            // Cache Supabase reads for offline viewing
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // disable in dev to avoid noise
      },
    }),
  ],
})

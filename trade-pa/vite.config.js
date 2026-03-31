import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

let pwaPlugin = null
try {
  const { VitePWA } = await import('vite-plugin-pwa')
  pwaPlugin = VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'Trade PA',
      short_name: 'Trade PA',
      description: 'Your AI-powered trade business assistant',
      theme_color: '#f59e0b',
      background_color: '#0f0f0f',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: 'trade-pa-logo.png', sizes: '192x192', type: 'image/png' },
        { src: 'trade-pa-logo.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg}'],
    },
  })
} catch (e) {
  console.log('vite-plugin-pwa not available, skipping PWA features')
}

export default defineConfig({
  plugins: [react(), pwaPlugin].filter(Boolean),
})

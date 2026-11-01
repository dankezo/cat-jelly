import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Chunked, lazy-loaded build: the 3D scene, the machine tiers and the
// photo panel are split out of the initial bundle so first paint stays small.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          rapier: ['@react-three/rapier'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})

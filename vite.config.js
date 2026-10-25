import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Three.js est volumineux : on évite un avertissement inutile au build
    chunkSizeWarningLimit: 1000,
  },
});

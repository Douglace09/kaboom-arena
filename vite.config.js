import { defineConfig } from 'vite';

export default defineConfig({
  // Chemins relatifs : le site marche à la racine de Netlify comme dans un sous-dossier
  base: './',
  build: {
    // Three.js est volumineux : on évite un avertissement inutile au build
    chunkSizeWarningLimit: 1000,
  },
});

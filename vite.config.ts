import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Arma las pantallas (carpeta web/) y las deja en dist/web para que el servidor las sirva.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: { root: '.', include: ['pruebas/**/*.test.ts'] },
});

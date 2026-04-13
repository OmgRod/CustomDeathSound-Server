import { defineConfig } from 'vite';

import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        verify: resolve(__dirname, 'src/frontend/verify.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'verify') return 'frontend/verify.js';
          return 'assets/[name].js';
        },
      },
    },
  },
});
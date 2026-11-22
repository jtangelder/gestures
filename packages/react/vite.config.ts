/// <reference types="vitest/config" />
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        trackpad: resolve(__dirname, 'src/trackpad.ts'),
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.es.js`,
    },
    rolldownOptions: {
      external: ['@gestures/core', '@gestures/trackpad', 'react'],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});

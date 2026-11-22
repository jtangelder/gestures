/// <reference types="vitest/config" />
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

export default defineConfig({
  root: __dirname,
  base: './',
  resolve: {
    alias: {
      '@gestures/core': resolve(rootDir, 'packages/core/src/index.ts'),
      '@gestures/react': resolve(rootDir, 'packages/react/src/index.ts'),
      '@gestures/trackpad': resolve(rootDir, 'packages/trackpad/src/index.ts'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        playground: resolve(__dirname, 'playground.html'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.test.{ts,tsx}'],
  },
});

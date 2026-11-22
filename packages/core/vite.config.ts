/// <reference types="vitest/config" />
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {playwright} from '@vitest/browser-playwright';
import {defineConfig} from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    target: ['chrome60', 'edge79', 'firefox59', 'safari13'],
    minify: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'gestures.es.js',
    },
    rolldownOptions: {
      transform: {
        assumptions: {
          setPublicClassFields: true,
        },
      },
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          // Reuses one jsdom per worker (environment setup dominated the run time).
          pool: 'vmThreads',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/browser/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({contextOptions: {hasTouch: true}}),
            instances: [{browser: 'chromium'}],
            viewport: {width: 800, height: 600},
          },
        },
      },
    ],
  },
});

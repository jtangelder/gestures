import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {build} from 'vite';

const coreEntry = resolve('packages/core/dist/gestures.es.js');
const reactEntry = resolve('packages/react/dist/index.es.js');
const reactTrackpadEntry = resolve('packages/react/dist/trackpad.es.js');
const trackpadEntry = resolve('packages/trackpad/dist/index.es.js');

const CHECKS = [
  {
    label: '@gestures/core (Gestures + tap)',
    maxGzipKb: 8.0,
    code: `import {Gestures, tap} from ${JSON.stringify(coreEntry)}; console.log(new Gestures(document.body, [tap({})]));`,
  },
  {
    label: '@gestures/core (Gestures + tap + pan)',
    maxGzipKb: 10.5,
    code: `import {Gestures, tap, pan} from ${JSON.stringify(coreEntry)}; console.log(new Gestures(document.body, [tap({}), pan({})]));`,
  },
  {
    label: '@gestures/core (full)',
    maxGzipKb: 12.5,
    code: `import * as G from ${JSON.stringify(coreEntry)}; console.log(G);`,
  },
  {
    label: '@gestures/react (useGestures)',
    maxGzipKb: 1.5,
    libEntry: reactEntry,
    external: ['@gestures/core', 'react'],
  },
  {
    label: '@gestures/react/trackpad',
    maxGzipKb: 0.8,
    libEntry: reactTrackpadEntry,
    external: ['@gestures/trackpad', 'react'],
  },
  {
    label: '@gestures/trackpad (TrackpadScale)',
    maxGzipKb: 2.5,
    libEntry: trackpadEntry,
    external: [],
  },
];

let failed = false;

for (const check of CHECKS) {
  const result = await build(
    check.libEntry
      ? {
          logLevel: 'silent',
          build: {
            write: false,
            minify: true,
            lib: {entry: check.libEntry, formats: ['es']},
            rollupOptions: {external: check.external},
          },
        }
      : {
          logLevel: 'silent',
          build: {
            write: false,
            minify: true,
            rollupOptions: {
              input: 'virtual:entry',
              plugins: [
                {
                  name: 'virtual-entry',
                  resolveId(id) {
                    return id === 'virtual:entry' ? id : null;
                  },
                  load(id) {
                    return id === 'virtual:entry' ? check.code : null;
                  },
                },
              ],
            },
          },
        }
  );

  const output = Array.isArray(result) ? result[0].output[0] : result.output[0];
  const minKb = Buffer.byteLength(output.code) / 1024;
  const gzipKb = gzipSync(output.code, {level: 9}).length / 1024;
  const ok = gzipKb <= check.maxGzipKb;
  if (!ok) failed = true;
  const status = ok ? 'OK  ' : 'FAIL';
  console.log(
    `${status} ${check.label.padEnd(40)} ${minKb.toFixed(2).padStart(6)} kB min | ${gzipKb.toFixed(2).padStart(5)} kB gzip (limit ${check.maxGzipKb.toFixed(1)} kB)`
  );
}

if (failed) {
  process.exitCode = 1;
}

/**
 * Dedicated entry point for the classic, non-ESM browser bundle (`dist/gestures.min.js`),
 * built via `vite.iife.config.ts` (`npm run build:iife`).
 *
 * This file is NOT imported by `src/index.ts` and is excluded from ESM / `.d.ts` output.
 * It attaches the public APIs onto `Gestures` and assigns `window.Gestures` for `<script>`
 * drop-in usage (intentionally omitting `GestureBinding`, which is only for framework adapters).
 */

import {gesture} from './descriptors.js';
import {GestureManager} from './gesture_manager.js';
import {GestureRecognizer} from './gesture_recognizer.js';
import {Gestures} from './gestures.js';
import {longPress, LongPressRecognizer} from './recognizers/long_press_recognizer.js';
import {pan, PanRecognizer, swipe} from './recognizers/pan_recognizer.js';
import {quickScale, QuickScaleRecognizer} from './recognizers/quick_scale_recognizer.js';
import {rotate, RotateRecognizer} from './recognizers/rotate_recognizer.js';
import {scale, ScaleRecognizer} from './recognizers/scale_recognizer.js';
import {doubleTap, tap, TapRecognizer} from './recognizers/tap_recognizer.js';

const GesturesGlobal = Object.assign(Gestures, {
  Gestures,
  GestureManager,
  gesture,
  GestureRecognizer,
  tap,
  doubleTap,
  longPress,
  pan,
  swipe,
  scale,
  quickScale,
  rotate,
  TapRecognizer,
  LongPressRecognizer,
  PanRecognizer,
  ScaleRecognizer,
  QuickScaleRecognizer,
  RotateRecognizer,
});

declare global {
  interface Window {
    Gestures?: typeof GesturesGlobal;
  }
}

if (typeof window !== 'undefined') {
  window.Gestures = GesturesGlobal;
}

export default GesturesGlobal;

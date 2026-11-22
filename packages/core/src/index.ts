/**
 * Tree-shakable ESM public entry point for `@gestures/core` (`dist/gestures.es.js`).
 */

export {Gestures, type GesturesOptions, type PointerType} from './gestures.js';
export {gesture, type GestureDescriptor} from './descriptors.js';
export {
  GestureRecognizer,
  type GestureEventData,
  type GestureKind,
  type RecognizerState,
} from './gesture_recognizer.js';
export type {MotionEvent, Point} from './motion_event.js';
export type {GestureTargetElement, TouchActionSetting, TouchActionValue} from './touch_action.js';

export {
  longPress,
  type LongPressEventData,
  type LongPressGestureOptions,
} from './recognizers/long_press_recognizer.js';
export {
  pan,
  swipe,
  type CardinalDirection,
  type PanDirection,
  type PanEventData,
  type PanGestureOptions,
  type SwipeEventData,
  type SwipeGestureOptions,
} from './recognizers/pan_recognizer.js';
export {quickScale, type QuickScaleGestureOptions} from './recognizers/quick_scale_recognizer.js';
export {
  rotate,
  type RotateEventData,
  type RotateGestureOptions,
} from './recognizers/rotate_recognizer.js';
export {
  scale,
  type ScaleEventData,
  type ScaleGestureOptions,
} from './recognizers/scale_recognizer.js';
export {
  doubleTap,
  tap,
  type DoubleTapGestureOptions,
  type TapGestureOptions,
} from './recognizers/tap_recognizer.js';

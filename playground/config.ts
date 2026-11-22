import type {PanDirection, TouchActionSetting, TouchActionValue} from '@gestures/core';

export interface Config {
  preset: string;
  pointerTouch: boolean;
  pointerPen: boolean;
  pointerMouse: boolean;
  touchAction: TouchActionSetting;
  enableSingleTap: boolean;
  enableDoubleTap: boolean;
  requireDoubleTapFailure: boolean;
  enableTwoFingerTap: boolean;
  enableLongPress: boolean;
  longPressPointers: number;
  enableLongPressMove: boolean;
  enablePan: boolean;
  enableSwipe: boolean;
  panDirection: PanDirection;
  panPointers: number;
  panSimultaneousScaleRotate: boolean;
  enableScale: boolean;
  enableQuickScale: boolean;
  quickScaleSensitivity: number;
  enableTrackpadScale: boolean;
  enableRotate: boolean;
  scaleRotateSimultaneous: boolean;
}

export interface Transform {
  tx: number;
  ty: number;
  scale: number;
  rot: number;
  animate: boolean;
}

export interface Telemetry {
  gesture: string;
  pointers: string;
  delta: string;
  velocity: string;
  scale: string;
  rotation: string;
}

export interface VisualPointer {
  id: number;
  type: string;
  x: number;
  y: number;
  pressure: number;
}

export interface LogEntry {
  seq: number;
  relMs: number;
  category: 'lifecycle' | 'move' | 'dom';
  name: string;
  summary: string;
}

export const BASE_CONFIG: Config = {
  preset: 'default',
  pointerTouch: true,
  pointerPen: true,
  pointerMouse: true,
  touchAction: 'compute',
  enableSingleTap: true,
  enableDoubleTap: true,
  requireDoubleTapFailure: true,
  enableTwoFingerTap: false,
  enableLongPress: true,
  longPressPointers: 1,
  enableLongPressMove: false,
  enablePan: true,
  enableSwipe: true,
  panDirection: 'both',
  panPointers: 1,
  panSimultaneousScaleRotate: false,
  enableScale: true,
  enableQuickScale: true,
  quickScaleSensitivity: 200,
  enableTrackpadScale: true,
  enableRotate: true,
  scaleRotateSimultaneous: true,
};

export const PRESETS: Record<string, {label: string; patch: Partial<Config>}> = {
  default: {label: 'All Gestures (Default)', patch: {}},
  carousel: {
    label: 'Horizontal Carousel (Vertical Scroll)',
    patch: {
      panDirection: 'horizontal',
      enableScale: false,
      enableQuickScale: false,
      enableTrackpadScale: false,
      enableRotate: false,
      enableLongPress: false,
    },
  },
  drawer: {
    label: 'Vertical Pull Sheet',
    patch: {
      panDirection: 'vertical',
      enableScale: false,
      enableQuickScale: false,
      enableTrackpadScale: false,
      enableRotate: false,
      enableLongPress: false,
    },
  },
  'feed-card': {
    label: 'Tap & LongPress Feed Card',
    patch: {
      enablePan: false,
      enableSwipe: false,
      enableScale: false,
      enableQuickScale: false,
      enableTrackpadScale: false,
      enableRotate: false,
    },
  },
  'image-viewer': {
    label: 'Pinch & Rotate Viewer',
    patch: {enableSingleTap: false, enableLongPress: false, enablePan: false, enableSwipe: false},
  },
  'map-2d': {
    label: '2D Map (Pan+Zoom+Rotate)',
    patch: {enableTwoFingerTap: true, panPointers: 0, panSimultaneousScaleRotate: true},
  },
  multitouch: {
    label: '2-Finger Multi-Touch Only',
    patch: {
      enableSingleTap: false,
      enableDoubleTap: false,
      enableTwoFingerTap: true,
      longPressPointers: 2,
      panPointers: 2,
      enableQuickScale: false,
      enableTrackpadScale: false,
    },
  },
  'hold-drag': {
    label: 'Hold & Drag Reorder (LongPress Move)',
    patch: {
      enableDoubleTap: false,
      enableLongPressMove: true,
      enablePan: false,
      enableSwipe: false,
      enableScale: false,
      enableQuickScale: false,
      enableTrackpadScale: false,
      enableRotate: false,
    },
  },
  'instant-tap': {
    label: 'Instant Tap vs. Double-Tap (No Delay)',
    patch: {
      requireDoubleTapFailure: false,
      enableLongPress: false,
      enablePan: false,
      enableSwipe: false,
      enableScale: false,
      enableQuickScale: false,
      enableTrackpadScale: false,
      enableRotate: false,
    },
  },
  'zoom-only': {
    label: 'Scroll-Safe Zoom Only (Pinch + QuickScale + Trackpad)',
    patch: {
      enableSingleTap: false,
      enableDoubleTap: false,
      enableLongPress: false,
      enablePan: false,
      enableSwipe: false,
      enableRotate: false,
    },
  },
  stylus: {
    label: 'Stylus / Drawing Surface (Pen Only)',
    patch: {
      pointerTouch: false,
      pointerPen: true,
      pointerMouse: false,
      enableSingleTap: false,
      enableDoubleTap: false,
      enableLongPress: false,
      enableSwipe: false,
      enableScale: false,
      enableQuickScale: false,
      enableTrackpadScale: false,
      enableRotate: false,
    },
  },
};

export const TOUCH_ACTIONS: readonly TouchActionValue[] = [
  'auto',
  'manipulation',
  'pan-x',
  'pan-y',
  'pan-x pan-y',
  'pan-x pinch-zoom',
  'pan-y pinch-zoom',
  'pinch-zoom',
  'none',
];

export const INITIAL_TRANSFORM: Transform = {tx: 0, ty: 0, scale: 1, rot: 0, animate: false};

export const INITIAL_TELEMETRY: Telemetry = {
  gesture: '—',
  pointers: '0 active',
  delta: '0, 0 px',
  velocity: '0 px/s',
  scale: '1.00×',
  rotation: '0.0°',
};

export const round = (n: number, d = 1): number => Math.round(n * 10 ** d) / 10 ** d;

export function readEnvRows(): Array<[string, string]> {
  const mq = (q: string) =>
    typeof window.matchMedia === 'function' ? window.matchMedia(q).matches : false;
  const unsupported = TOUCH_ACTIONS.filter(
    t =>
      !(
        typeof CSS !== 'undefined' &&
        typeof CSS.supports === 'function' &&
        CSS.supports('touch-action', t)
      )
  );
  return [
    [
      'Viewport / DPR',
      `${window.innerWidth} × ${window.innerHeight} @ ${round(window.devicePixelRatio || 1, 2)}x`,
    ],
    ['Max Touch Points', `${navigator.maxTouchPoints ?? 0}`],
    [
      'Pointer & Hover',
      `${mq('(pointer: coarse)') ? 'coarse' : mq('(pointer: fine)') ? 'fine' : 'none'} · any-coarse=${mq('(any-pointer: coarse)')} · hover=${mq('(any-hover: hover)')}`,
    ],
    [
      'getCoalescedEvents()',
      typeof PointerEvent !== 'undefined' && 'getCoalescedEvents' in PointerEvent.prototype
        ? 'Supported'
        : 'Unsupported',
    ],
    ['WebKit GestureEvent', 'GestureEvent' in window ? 'Present (Safari/WebKit)' : 'Not present'],
    [
      'CSS touch-action',
      unsupported.length === 0
        ? 'All 9 W3C tokens supported'
        : `Missing: ${unsupported.join(', ')}`,
    ],
  ];
}

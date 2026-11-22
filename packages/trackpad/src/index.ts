const DEFAULT_SENSITIVITY = 100;
const DEFAULT_END_TIMEOUT_MS = 150;
const FORM_CONTROL_SELECTOR = 'input,textarea,select,option';
const NON_PASSIVE: AddEventListenerOptions = {passive: false};
const PASSIVE: AddEventListenerOptions = {passive: true};
const ZERO_POINT: TrackpadPoint = {x: 0, y: 0};

// Coordinates nested `TrackpadScale` surfaces without calling `stopPropagation()`.
const claimedEvents = new WeakSet<Event>();

interface WebKitGestureEvent extends Event {
  readonly scale?: number;
  readonly clientX?: number;
  readonly clientY?: number;
}

export type TrackpadTargetElement = HTMLElement | SVGElement;

export interface TrackpadPoint {
  readonly x: number;
  readonly y: number;
}

export interface TrackpadScaleEvent {
  /** Cursor focal point (`{x, y}`) in viewport (`clientX`/`clientY`) coordinates. */
  readonly center: TrackpadPoint;
  /** Cumulative scale ratio relative to gesture start (`1.0` = original size). */
  readonly scale: number;
  /** Incremental frame-to-frame scale ratio. */
  readonly scaleFactor: number;
  /** DOM target of the triggering event (`originalEvent.target`). */
  readonly target: EventTarget | null;
  /** Underlying DOM `WheelEvent` or Safari `GestureEvent`. */
  readonly originalEvent: Event;
}

export interface TrackpadScaleOptions {
  /** Whether trackpad pinch listening is active. Default: `true`. */
  enabled?: boolean;
  /** Wheel `deltaY` magnitude in `px` that doubles (`2x`) or halves (`0.5x`) scale. Default: `100`. */
  sensitivity?: number;
  /** Idle duration in `ms` after the last `ctrl+wheel` event before `onScaleEnd` fires. Default: `150`. */
  endTimeout?: number;
  /**
   * Controls whether events on interactive form/editable controls are ignored:
   * - `true` (default): ignores `<input>`, `<textarea>`, `<select>`, `<option>`, `[contenteditable]`.
   * - `false`: observes all targets.
   * - `(target, event) => boolean`: custom predicate returning `true` to ignore.
   */
  ignoreTarget?: boolean | ((target: EventTarget, event: Event) => boolean);
  /**
   * When `false` (default), an inner `TrackpadScale` claims bubbling events so outer instances do
   * not double-zoom. Set `true` to observe simultaneously.
   */
  propagate?: boolean;
  onScaleStart?: (event: TrackpadScaleEvent) => void;
  onScale?: (event: TrackpadScaleEvent) => void;
  onScaleEnd?: (event: TrackpadScaleEvent) => void;
  onScaleCancel?: () => void;
}

function validScale(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function wheelScaleFactor(e: WheelEvent, sensitivity: number): number {
  const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  if (!Number.isFinite(dy) || dy === 0) return 1;
  const factor = Math.pow(2, -dy / sensitivity);
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

function isEditableTarget(target: EventTarget, boundary: Element): boolean {
  const el =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  if (!el) return false;
  const control = el.closest(FORM_CONTROL_SELECTOR);
  if (control && boundary.contains(control)) return true;
  const editable = el.closest('[contenteditable]');
  return (
    !!editable &&
    editable.getAttribute('contenteditable')?.toLowerCase() !== 'false' &&
    boundary.contains(editable)
  );
}

/**
 * Standalone laptop trackpad pinch-to-zoom controller supporting W3C `ctrl` + `wheel`
 * (Chrome, Edge, Firefox, Safari) and macOS Safari `GestureEvent` (`gesturestart` /
 * `gesturechange` / `gestureend`).
 */
export class TrackpadScale<T extends TrackpadTargetElement = TrackpadTargetElement> {
  readonly element: T;
  private readonly options: TrackpadScaleOptions;
  private readonly sensitivity: number;
  private readonly endTimeout: number;
  private readonly propagate: boolean;
  private readonly hasGestureEvents: boolean;

  private mode: 'idle' | 'wheel' | 'gesture' = 'idle';
  private cumulativeScale = 1;
  private lastGestureScale = 1;
  private lastEvent: Event | null = null;
  private lastCenter: TrackpadPoint = ZERO_POINT;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private activeTouches = 0;
  private destroyed = false;

  constructor(element: T, options: TrackpadScaleOptions = {}) {
    this.element = element;
    this.options = options;
    this.sensitivity =
      options.sensitivity && options.sensitivity > 0 ? options.sensitivity : DEFAULT_SENSITIVITY;
    this.endTimeout =
      options.endTimeout !== undefined && options.endTimeout >= 0
        ? options.endTimeout
        : DEFAULT_END_TIMEOUT_MS;
    this.propagate = options.propagate ?? false;
    const win = element.ownerDocument.defaultView;
    this.hasGestureEvents = !!win && 'GestureEvent' in win;

    if (options.enabled !== false) {
      element.addEventListener('wheel', this, NON_PASSIVE);
      if (this.hasGestureEvents) {
        element.addEventListener('gesturestart', this, NON_PASSIVE);
        element.addEventListener('gesturechange', this, NON_PASSIVE);
        element.addEventListener('gestureend', this, NON_PASSIVE);
        // Track active touches passively so iOS/iPadOS touchscreen pinches don't trigger trackpad scale.
        element.addEventListener('touchstart', this, PASSIVE);
        element.addEventListener('touchend', this, PASSIVE);
        element.addEventListener('touchcancel', this, PASSIVE);
      }
    }
  }

  /** Cancels any active trackpad pinch, clearing pending timers and invoking `onScaleCancel`. */
  cancel(): void {
    if (this.destroyed || this.mode === 'idle') return;
    this.clearActiveState();
    this.options.onScaleCancel?.();
  }

  /** Detaches all DOM listeners and clears any pending timers. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearActiveState();
    const el = this.element;
    el.removeEventListener('wheel', this, NON_PASSIVE);
    if (this.hasGestureEvents) {
      el.removeEventListener('gesturestart', this, NON_PASSIVE);
      el.removeEventListener('gesturechange', this, NON_PASSIVE);
      el.removeEventListener('gestureend', this, NON_PASSIVE);
      el.removeEventListener('touchstart', this, PASSIVE);
      el.removeEventListener('touchend', this, PASSIVE);
      el.removeEventListener('touchcancel', this, PASSIVE);
    }
  }

  /** @internal */
  handleEvent(ev: Event): void {
    switch (ev.type) {
      case 'wheel':
        this.onWheel(ev as WheelEvent);
        break;
      case 'gesturestart':
        this.onGestureStart(ev as WebKitGestureEvent);
        break;
      case 'gesturechange':
        this.onGestureChange(ev as WebKitGestureEvent);
        break;
      case 'gestureend':
        if (this.mode === 'gesture') {
          if (ev.cancelable) ev.preventDefault();
          this.end(ev, this.gestureCenter(ev as WebKitGestureEvent));
        }
        break;
      case 'touchstart':
      case 'touchend':
      case 'touchcancel':
        this.activeTouches = (ev as TouchEvent).touches?.length ?? 0;
        break;
      case 'blur':
        this.cancel();
        break;
      case 'visibilitychange':
        if (this.element.ownerDocument.visibilityState === 'hidden') this.cancel();
        break;
    }
  }

  private onWheel(e: WheelEvent): void {
    if (!e.ctrlKey || this.shouldSkip(e)) return;

    // Safari may also emit `ctrl+wheel` during a `GestureEvent`; block zoom without double-emitting.
    if (this.mode === 'gesture') {
      this.claim(e);
      return;
    }

    const factor = wheelScaleFactor(e, this.sensitivity);
    if (factor === 1) {
      if (e.cancelable) e.preventDefault();
      return;
    }

    const center: TrackpadPoint = {x: e.clientX, y: e.clientY};
    if (this.mode === 'idle') {
      if (!this.start('wheel', e, center)) return;
    } else {
      this.claim(e);
    }

    this.step(e, center, factor);
    if (this.mode === 'wheel') {
      this.clearEndTimer();
      this.endTimer = setTimeout(() => {
        this.endTimer = null;
        if (this.mode === 'wheel') this.end(this.lastEvent, this.lastCenter);
      }, this.endTimeout);
    }
  }

  private onGestureStart(e: WebKitGestureEvent): void {
    if (this.activeTouches > 0 || this.shouldSkip(e)) return;
    if (this.mode === 'wheel') this.end(this.lastEvent, this.lastCenter);
    const initial = validScale(e.scale) ?? 1;
    if (this.start('gesture', e, this.gestureCenter(e))) {
      this.lastGestureScale = initial;
    }
  }

  private onGestureChange(e: WebKitGestureEvent): void {
    if (this.mode !== 'gesture') return;
    if (e.cancelable) e.preventDefault();
    const rawScale = validScale(e.scale);
    if (rawScale === null) return;

    const factor = rawScale / this.lastGestureScale;
    const center = this.gestureCenter(e);
    this.lastEvent = e;
    this.lastCenter = center;
    if (factor !== 1) {
      this.lastGestureScale = rawScale;
      this.step(e, center, factor);
    }
  }

  private shouldSkip(e: Event): boolean {
    if (this.destroyed || (!this.propagate && claimedEvents.has(e))) return true;
    const {ignoreTarget = true} = this.options;
    if (ignoreTarget === false) return false;
    const target = e.composedPath()[0] ?? e.target;
    if (!target) return false;
    return typeof ignoreTarget === 'function'
      ? ignoreTarget(target, e)
      : isEditableTarget(target, this.element);
  }

  private start(mode: 'wheel' | 'gesture', e: Event, center: TrackpadPoint): boolean {
    this.claim(e);
    this.mode = mode;
    this.cumulativeScale = 1;
    this.lastGestureScale = 1;
    this.lastEvent = e;
    this.lastCenter = center;
    this.setWindowListeners(true);
    this.options.onScaleStart?.(this.buildEvent(e, center, 1, 1));
    return this.mode === mode;
  }

  private step(e: Event, center: TrackpadPoint, scaleFactor: number): void {
    this.lastEvent = e;
    this.lastCenter = center;
    const nextScale = this.cumulativeScale * scaleFactor;
    if (!Number.isFinite(nextScale) || nextScale <= 0) return;
    this.cumulativeScale = nextScale;
    this.options.onScale?.(this.buildEvent(e, center, nextScale, scaleFactor));
  }

  private end(e: Event | null, center: TrackpadPoint): void {
    const finalScale = this.cumulativeScale;
    this.clearActiveState();
    if (e) this.options.onScaleEnd?.(this.buildEvent(e, center, finalScale, 1));
  }

  private claim(e: Event): void {
    if (!this.propagate) claimedEvents.add(e);
    if (e.cancelable) e.preventDefault();
  }

  private setWindowListeners(attach: boolean): void {
    const doc = this.element.ownerDocument;
    const method = attach ? 'addEventListener' : 'removeEventListener';
    doc[method]('visibilitychange', this);
    doc.defaultView?.[method]('blur', this);
  }

  private clearEndTimer(): void {
    if (this.endTimer !== null) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
  }

  private clearActiveState(): void {
    this.clearEndTimer();
    this.setWindowListeners(false);
    this.mode = 'idle';
    this.cumulativeScale = 1;
    this.lastGestureScale = 1;
    this.lastEvent = null;
    this.lastCenter = ZERO_POINT;
  }

  private gestureCenter(e: WebKitGestureEvent): TrackpadPoint {
    return typeof e.clientX === 'number' &&
      typeof e.clientY === 'number' &&
      Number.isFinite(e.clientX) &&
      Number.isFinite(e.clientY)
      ? {x: e.clientX, y: e.clientY}
      : this.lastCenter;
  }

  private buildEvent(
    originalEvent: Event,
    center: TrackpadPoint,
    scale: number,
    scaleFactor: number
  ): TrackpadScaleEvent {
    return {
      center,
      scale,
      scaleFactor,
      target: originalEvent.target,
      originalEvent,
    };
  }
}

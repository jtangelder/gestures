import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {resolveGestures} from '../src/descriptors';
import {
  doubleTap,
  gesture,
  Gestures,
  GestureRecognizer,
  longPress,
  pan,
  quickScale,
  rotate,
  scale,
  swipe,
  tap,
} from '../src/index';
import {pointerEvent} from './test_helpers';

describe('Gesture descriptors and resolveGestures', () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
    vi.useRealTimers();
  });

  it('auto-wires smart defaults in Gestures (tap/doubleTap/quickScale/pan/scale/rotate)', () => {
    vi.useFakeTimers();
    const onTap = vi.fn();
    const onDoubleTap = vi.fn();
    const onScale = vi.fn();
    const onRotate = vi.fn();
    const onPan = vi.fn();

    const gm = new Gestures(element, [
      tap({onTap}),
      doubleTap({onTap: onDoubleTap}),
      pan({numPointers: 0, slop: 4, onPan}),
      scale({spanSlop: 6, minSpan: 10, onScale}),
      quickScale({sensitivity: 100, onScale}),
      rotate({rotationSlop: 2, minSpan: 10, onRotate}),
    ]);

    // 1. Single tap waits for doubleTap + quickScale timeout before firing:
    element.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 1, clientX: 50, clientY: 50, timeStamp: 0})
    );
    document.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 1, clientX: 50, clientY: 50, timeStamp: 25})
    );
    expect(onTap).not.toHaveBeenCalled();
    vi.advanceTimersByTime(310);
    expect(onTap).toHaveBeenCalledTimes(1);

    // 2. QuickScale auto-caps default slop to pan.slop (4) and wins over Pan on stroke #2:
    onTap.mockClear();
    element.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 2, clientX: 50, clientY: 50, timeStamp: 500})
    );
    document.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 2, clientX: 50, clientY: 50, timeStamp: 525})
    );
    element.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 3, clientX: 50, clientY: 50, timeStamp: 600})
    );
    document.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 3, clientX: 50, clientY: 56, timeStamp: 616})
    );
    document.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 3, clientX: 50, clientY: 154, timeStamp: 632})
    );
    document.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 3, clientX: 50, clientY: 154, timeStamp: 648})
    );
    expect(onScale).toHaveBeenCalledWith(expect.objectContaining({isQuickScale: true}));
    expect(onPan).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();

    // 3. Simultaneous 2-finger pan(0) + scale + rotate:
    onScale.mockClear();
    element.dispatchEvent(
      pointerEvent('pointerdown', {
        pointerId: 4,
        isPrimary: true,
        clientX: 0,
        clientY: 0,
        timeStamp: 1200,
      })
    );
    element.dispatchEvent(
      pointerEvent('pointerdown', {
        pointerId: 5,
        isPrimary: false,
        clientX: 100,
        clientY: 0,
        timeStamp: 1200,
      })
    );
    document.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 4, clientX: 20, clientY: 10, timeStamp: 1216})
    );
    document.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 5, clientX: 180, clientY: 80, timeStamp: 1216})
    );
    document.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 5, clientX: 180, clientY: 80, timeStamp: 1232})
    );
    document.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 4, clientX: 20, clientY: 10, timeStamp: 1232})
    );
    expect(onPan).toHaveBeenCalled();
    expect(onScale).toHaveBeenCalledWith(expect.objectContaining({isQuickScale: false}));
    expect(onRotate).toHaveBeenCalled();

    gm.destroy();
  });

  it('supports explicit chained relationships and autoWire: false opt-out', () => {
    vi.useFakeTimers();
    const onTap = vi.fn();
    const onDoubleTap = vi.fn();

    // With `autoWire: false`, single tap fires immediately without waiting for doubleTap:
    const gmNoAuto = new Gestures(element, [tap({onTap}), doubleTap({onTap: onDoubleTap})], {
      autoWire: false,
    });
    element.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 1, clientX: 10, clientY: 10, timeStamp: 0})
    );
    document.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 1, clientX: 10, clientY: 10, timeStamp: 20})
    );
    expect(onTap).toHaveBeenCalledTimes(1);
    gmNoAuto.destroy();

    // Explicit `requireFailureOf` works via chaining even when `autoWire: false`:
    const onHold = vi.fn();
    const onPanStart = vi.fn();
    const hold = longPress({duration: 400, slop: 20, onLongPress: onHold});
    const drag = pan({slop: 4, onPanStart}).requireFailureOf(hold);

    const gmExplicit = new Gestures(element, [hold, drag], {autoWire: false});
    element.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 2, clientX: 0, clientY: 0, timeStamp: 100})
    );
    // 10px > pan.slop(4) but < hold.slop(20): drag waits in pending until hold fails or fires:
    document.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 2, clientX: 10, clientY: 0, timeStamp: 116})
    );
    expect(onPanStart).not.toHaveBeenCalled();

    // Exceeding hold.slop(20) fails hold and grants pending drag:
    document.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 2, clientX: 25, clientY: 0, timeStamp: 132})
    );
    expect(onPanStart).toHaveBeenCalledTimes(1);
    expect(onHold).not.toHaveBeenCalled();
    gmExplicit.destroy();

    // Empty resolveGestures returns []:
    expect(resolveGestures([])).toEqual([]);
  });

  it('supports shorthand new Gestures(element, gestures, options?) constructor', () => {
    const onTap = vi.fn();
    const gm = new Gestures(element, [tap({onTap})], {supportedPointerTypes: ['touch']});
    expect(element.style.touchAction).toBe('manipulation');

    // Mouse is filtered out by options passed as 3rd argument
    element.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 1, pointerType: 'mouse', clientX: 10, timeStamp: 0})
    );
    document.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 1, pointerType: 'mouse', clientX: 10, timeStamp: 20})
    );
    expect(onTap).not.toHaveBeenCalled();

    // Touch fires onTap
    element.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 2, pointerType: 'touch', clientX: 10, timeStamp: 40})
    );
    document.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 2, pointerType: 'touch', clientX: 10, timeStamp: 60})
    );
    expect(onTap).toHaveBeenCalledTimes(1);

    gm.destroy();
  });

  it('supports custom recognizers via gesture() alongside built-in descriptors', () => {
    class InstantPressRecognizer extends GestureRecognizer {
      private readonly callbacks: {onPress?: (tag: string) => void};
      private readonly tag: string;

      constructor(callbacks: {onPress?: (tag: string) => void}, tag: string) {
        super();
        this.callbacks = callbacks;
        this.tag = tag;
      }

      protected override onDown(): void {
        this.tryRecognizeDiscrete(() => {
          this.callbacks.onPress?.(this.tag);
        });
      }
    }

    const calls: string[] = [];
    const custom = gesture(
      cbs => new InstantPressRecognizer(cbs, 'a'),
      {onPress: t => calls.push(`press:${t}`)},
      {tag: 'a'}
    );
    const t = tap({onTap: () => calls.push('tap')}).simultaneousWith(custom);

    const gm = new Gestures(element, [custom, t]);
    element.dispatchEvent(pointerEvent('pointerdown', {pointerId: 1, clientX: 10, timeStamp: 0}));
    document.dispatchEvent(pointerEvent('pointerup', {pointerId: 1, clientX: 10, timeStamp: 20}));
    expect(calls).toEqual(['press:a', 'tap']);
    gm.destroy();

    // Duplicate peer descriptors deduplicate cleanly:
    const dupTarget = doubleTap({onTap: () => {}});
    const dupTap = tap({onTap: () => {}}).requireFailureOf(dupTarget, dupTarget);
    expect(dupTap.requiredFailures).toHaveLength(1);
  });

  it('supports swipe() descriptor in Gestures', () => {
    const onSwipe = vi.fn();
    const gm = new Gestures(element, [
      swipe({direction: 'horizontal', minSwipeVelocity: 200, minSwipeDistance: 30, onSwipe}),
    ]);
    expect(element.style.touchAction).toBe('pan-y pinch-zoom');

    element.dispatchEvent(pointerEvent('pointerdown', {pointerId: 1, clientX: 0, timeStamp: 0}));
    document.dispatchEvent(pointerEvent('pointermove', {pointerId: 1, clientX: 50, timeStamp: 10}));
    document.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 1, clientX: 100, timeStamp: 20})
    );
    document.dispatchEvent(pointerEvent('pointerup', {pointerId: 1, clientX: 100, timeStamp: 24}));
    expect(onSwipe).toHaveBeenCalledWith(
      expect.objectContaining({direction: 'right', pointerType: 'touch'})
    );
    gm.destroy();
  });
});

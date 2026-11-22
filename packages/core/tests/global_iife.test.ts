import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import type GesturesGlobal from '../src/global';
import {pointerEvent} from './test_helpers';

const bundlePath = resolve(__dirname, '../dist/gestures.min.js');

describe('Classic browser drop-in bundle (dist/gestures.min.js)', () => {
  let code: string;
  let GesturesCtor: typeof GesturesGlobal;

  beforeAll(() => {
    code = readFileSync(bundlePath, 'utf8');
    // Evaluate as classic non-module script in the window global scope
    const script = document.createElement('script');
    script.textContent = code;
    document.head.appendChild(script);
    script.remove();
    GesturesCtor = window.Gestures!;
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits classic IIFE output without ESM syntax and exposes window.Gestures', () => {
    expect(code).not.toMatch(/\bexport\s+/);
    expect(code).not.toMatch(/\bimport\s+/);

    expect(typeof GesturesCtor).toBe('function');
    expect(GesturesCtor.Gestures).toBe(GesturesCtor);
    expect(typeof GesturesCtor.GestureManager).toBe('function');
    expect('GestureBinding' in GesturesCtor).toBe(false);
    expect(typeof GesturesCtor.gesture).toBe('function');
    expect(typeof GesturesCtor.GestureRecognizer).toBe('function');
    expect(typeof GesturesCtor.tap).toBe('function');
    expect(typeof GesturesCtor.doubleTap).toBe('function');
    expect(typeof GesturesCtor.longPress).toBe('function');
    expect(typeof GesturesCtor.pan).toBe('function');
    expect(typeof GesturesCtor.swipe).toBe('function');
    expect(typeof GesturesCtor.scale).toBe('function');
    expect(typeof GesturesCtor.quickScale).toBe('function');
    expect(typeof GesturesCtor.rotate).toBe('function');
  });

  it('recognizes tap, doubleTap, longPress, pan, swipe, scale, rotate, and quickScale', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const onTap = vi.fn();
    const onDoubleTap = vi.fn();
    const onLongPress = vi.fn();
    const onPan = vi.fn();
    const onSwipe = vi.fn();
    const onScale = vi.fn();
    const onRotate = vi.fn();

    const gestures = new GesturesCtor(el, {
      onTap,
      onDoubleTap,
      onLongPress,
      onPan,
      onSwipe,
      onScale,
      onRotate,
      quickScale: true,
    });

    expect(el.style.touchAction).toBe('none');

    // 1. Single tap (waits for doubleTap window)
    el.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 1, clientX: 50, clientY: 50, timeStamp: 100})
    );
    el.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 1, clientX: 50, clientY: 50, timeStamp: 120})
    );
    vi.advanceTimersByTime(350);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap.mock.calls[0][0].pointerType).toBe('touch');
    expect(onTap.mock.calls[0][0].center).toEqual({x: 50, y: 50});

    // 2. Double tap
    el.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 2, clientX: 60, clientY: 60, timeStamp: 600})
    );
    el.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 2, clientX: 60, clientY: 60, timeStamp: 620})
    );
    el.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 3, clientX: 62, clientY: 60, timeStamp: 700})
    );
    el.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 3, clientX: 62, clientY: 60, timeStamp: 720})
    );
    expect(onDoubleTap).toHaveBeenCalledTimes(1);

    // 3. Long press
    el.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 4, clientX: 80, clientY: 80, timeStamp: 1200})
    );
    vi.advanceTimersByTime(550);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    el.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 4, clientX: 80, clientY: 80, timeStamp: 1760})
    );

    // 4. Fast pan + swipe right
    el.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 5, clientX: 10, clientY: 100, timeStamp: 2000})
    );
    el.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 5, clientX: 40, clientY: 100, timeStamp: 2010})
    );
    el.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 5, clientX: 90, clientY: 100, timeStamp: 2020})
    );
    el.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 5, clientX: 160, clientY: 100, timeStamp: 2030})
    );
    el.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 5, clientX: 160, clientY: 100, timeStamp: 2035})
    );
    expect(onPan).toHaveBeenCalled();
    expect(onPan.mock.calls.at(-1)![0].deltaX).toBeGreaterThan(100);
    expect(onSwipe).toHaveBeenCalledTimes(1);
    expect(onSwipe.mock.calls[0][0].direction).toBe('right');

    // 5. Two-finger pinch + rotate
    el.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 6, clientX: 100, clientY: 100, timeStamp: 3000})
    );
    el.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 7, clientX: 200, clientY: 100, timeStamp: 3005})
    );
    el.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 7, clientX: 240, clientY: 180, timeStamp: 3020})
    );
    el.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 7, clientX: 260, clientY: 240, timeStamp: 3040})
    );
    el.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 6, clientX: 100, clientY: 100, timeStamp: 3060})
    );
    el.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 7, clientX: 260, clientY: 240, timeStamp: 3065})
    );
    expect(onScale).toHaveBeenCalled();
    expect(onScale.mock.calls.at(-1)![0].scale).toBeGreaterThan(1);
    expect(onRotate).toHaveBeenCalled();
    expect(Math.abs(onRotate.mock.calls.at(-1)![0].rotation)).toBeGreaterThan(5);

    // 6. Destroy cleans up touch-action
    gestures.destroy();
    expect(el.style.touchAction).toBe('');
    el.remove();
  });

  it('supports modular Gestures.GestureManager + descriptors on window.Gestures', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const onSwipe = vi.fn();
    const gm = new GesturesCtor.GestureManager(el, {
      gestures: [GesturesCtor.swipe({direction: 'horizontal', onSwipe})],
    });

    expect(el.style.touchAction).toBe('pan-y pinch-zoom');

    el.dispatchEvent(
      pointerEvent('pointerdown', {pointerId: 10, clientX: 200, clientY: 50, timeStamp: 100})
    );
    el.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 10, clientX: 140, clientY: 50, timeStamp: 110})
    );
    el.dispatchEvent(
      pointerEvent('pointermove', {pointerId: 10, clientX: 70, clientY: 50, timeStamp: 120})
    );
    el.dispatchEvent(
      pointerEvent('pointerup', {pointerId: 10, clientX: 70, clientY: 50, timeStamp: 125})
    );

    expect(onSwipe).toHaveBeenCalledTimes(1);
    expect(onSwipe.mock.calls[0][0].direction).toBe('left');

    gm.destroy();
    el.remove();
  });
});

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TrackpadScale, type TrackpadScaleEvent} from '../src/index';

function wheelPinchEvent(
  init: Partial<WheelEventInit> & {ctrlKey?: boolean; deltaY?: number; deltaMode?: number} = {}
): WheelEvent {
  return new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    clientX: 100,
    clientY: 120,
    deltaY: -100,
    deltaMode: 0,
    ...init,
  });
}

function safariGestureEvent(
  type: 'gesturestart' | 'gesturechange' | 'gestureend',
  scale: number,
  clientX = 140,
  clientY = 160
): Event {
  const ev = new Event(type, {bubbles: true, cancelable: true});
  Object.defineProperties(ev, {
    scale: {value: scale, configurable: true},
    clientX: {value: clientX, configurable: true},
    clientY: {value: clientY, configurable: true},
  });
  return ev;
}

function touchEvent(type: 'touchstart' | 'touchend' | 'touchcancel', count: number): Event {
  const ev = new Event(type, {bubbles: true, cancelable: true});
  Object.defineProperty(ev, 'touches', {value: {length: count}, configurable: true});
  return ev;
}

describe('@gestures/trackpad TrackpadScale', () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
    vi.useRealTimers();
    delete (window as unknown as {GestureEvent?: unknown}).GestureEvent;
  });

  it('recognizes ctrl+wheel pinch zoom, prevents browser zoom, and ends after idle timeout', () => {
    const onScaleStart = vi.fn();
    const onScale = vi.fn();
    const onScaleEnd = vi.fn();

    const trackpad = new TrackpadScale(element, {onScaleStart, onScale, onScaleEnd});

    const ev1 = wheelPinchEvent({deltaY: -100, clientX: 80, clientY: 90});
    element.dispatchEvent(ev1);

    expect(ev1.defaultPrevented).toBe(true);
    expect(onScaleStart).toHaveBeenCalledTimes(1);
    expect(onScaleStart).toHaveBeenCalledWith({
      center: {x: 80, y: 90},
      scale: 1,
      scaleFactor: 1,
      target: element,
      originalEvent: ev1,
    });
    expect(onScale).toHaveBeenCalledTimes(1);
    expect((onScale.mock.calls[0][0] as TrackpadScaleEvent).scale).toBeCloseTo(2, 5);
    expect((onScale.mock.calls[0][0] as TrackpadScaleEvent).scaleFactor).toBeCloseTo(2, 5);

    element.dispatchEvent(wheelPinchEvent({deltaY: 100, clientX: 85, clientY: 95}));
    expect(onScale).toHaveBeenCalledTimes(2);
    expect((onScale.mock.calls[1][0] as TrackpadScaleEvent).scale).toBeCloseTo(1, 5);

    vi.advanceTimersByTime(149);
    expect(onScaleEnd).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onScaleEnd).toHaveBeenCalledTimes(1);
    expect(onScaleEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        center: {x: 85, y: 95},
        scale: 1,
        scaleFactor: 1,
      })
    );

    // Consecutive pinch works cleanly
    element.dispatchEvent(wheelPinchEvent({deltaY: -50}));
    expect(onScaleStart).toHaveBeenCalledTimes(2);
    expect((onScale.mock.calls[2][0] as TrackpadScaleEvent).scale).toBeCloseTo(Math.SQRT2, 5);

    trackpad.destroy();
  });

  it('ignores non-ctrl wheel scrolling without calling preventDefault', () => {
    const onScale = vi.fn();
    const trackpad = new TrackpadScale(element, {onScale});

    const wheel = wheelPinchEvent({ctrlKey: false, deltaY: -120});
    element.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(false);
    expect(onScale).not.toHaveBeenCalled();

    trackpad.destroy();
  });

  it('normalizes deltaMode (line & page) and respects sensitivity, endTimeout, and enabled: false', () => {
    const onScale = vi.fn();
    const onScaleEnd = vi.fn();
    const trackpad = new TrackpadScale(element, {
      sensitivity: 160,
      endTimeout: 80,
      onScale,
      onScaleEnd,
    });

    element.dispatchEvent(wheelPinchEvent({deltaY: -10, deltaMode: 1}));
    expect((onScale.mock.calls[0][0] as TrackpadScaleEvent).scale).toBeCloseTo(2, 5);

    element.dispatchEvent(wheelPinchEvent({deltaY: 0.4, deltaMode: 2}));
    expect((onScale.mock.calls[1][0] as TrackpadScaleEvent).scale).toBeCloseTo(1, 5);

    vi.advanceTimersByTime(80);
    expect(onScaleEnd).toHaveBeenCalledTimes(1);
    trackpad.destroy();

    const disabledOnScale = vi.fn();
    const disabled = new TrackpadScale(element, {enabled: false, onScale: disabledOnScale});
    const ev = wheelPinchEvent({deltaY: -100});
    element.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(disabledOnScale).not.toHaveBeenCalled();
    disabled.destroy();
  });

  it('handles macOS Safari GestureEvent lifecycle and suppresses duplicate ctrl+wheel', () => {
    (window as unknown as {GestureEvent: unknown}).GestureEvent = Event;

    const onScaleStart = vi.fn();
    const onScale = vi.fn();
    const onScaleEnd = vi.fn();
    const trackpad = new TrackpadScale(element, {onScaleStart, onScale, onScaleEnd});

    const start = safariGestureEvent('gesturestart', 1.0, 200, 150);
    element.dispatchEvent(start);
    expect(start.defaultPrevented).toBe(true);
    expect(onScaleStart).toHaveBeenCalledWith(
      expect.objectContaining({center: {x: 200, y: 150}, scale: 1, scaleFactor: 1})
    );

    const change1 = safariGestureEvent('gesturechange', 1.5, 205, 155);
    element.dispatchEvent(change1);
    expect(change1.defaultPrevented).toBe(true);
    expect((onScale.mock.calls[0][0] as TrackpadScaleEvent).scale).toBeCloseTo(1.5, 5);

    // Companion ctrl+wheel fired by Safari is prevented without double-emitting
    const companionWheel = wheelPinchEvent({deltaY: -40});
    element.dispatchEvent(companionWheel);
    expect(companionWheel.defaultPrevented).toBe(true);
    expect(onScale).toHaveBeenCalledTimes(1);

    const end = safariGestureEvent('gestureend', 1.5, 205, 155);
    element.dispatchEvent(end);
    expect(end.defaultPrevented).toBe(true);
    expect(onScaleEnd).toHaveBeenCalledTimes(1);
    expect((onScaleEnd.mock.calls[0][0] as TrackpadScaleEvent).scale).toBeCloseTo(1.5, 5);

    trackpad.destroy();
  });

  it('ignores WebKit GestureEvent during active touchscreen contact (iOS/iPadOS Safari)', () => {
    (window as unknown as {GestureEvent: unknown}).GestureEvent = Event;

    const onScaleStart = vi.fn();
    const onScale = vi.fn();
    const trackpad = new TrackpadScale(element, {onScaleStart, onScale});

    element.dispatchEvent(touchEvent('touchstart', 2));
    element.dispatchEvent(safariGestureEvent('gesturestart', 1.0));
    element.dispatchEvent(safariGestureEvent('gesturechange', 1.8));
    element.dispatchEvent(safariGestureEvent('gestureend', 1.8));
    expect(onScaleStart).not.toHaveBeenCalled();
    expect(onScale).not.toHaveBeenCalled();

    // Once touches lift, trackpad GestureEvent works again
    element.dispatchEvent(touchEvent('touchend', 0));
    element.dispatchEvent(safariGestureEvent('gesturestart', 1.0));
    element.dispatchEvent(safariGestureEvent('gesturechange', 1.5));
    element.dispatchEvent(safariGestureEvent('gestureend', 1.5));
    expect(onScaleStart).toHaveBeenCalledTimes(1);
    expect(onScale).toHaveBeenCalledTimes(1);

    trackpad.destroy();
  });

  it('cancels cleanly on cancel(), blur, and callback-triggered cancel/destroy without dangling timers', () => {
    const onScaleCancel = vi.fn();
    const onScaleEnd = vi.fn();
    const trackpad = new TrackpadScale(element, {onScaleCancel, onScaleEnd});

    element.dispatchEvent(wheelPinchEvent({deltaY: -50}));
    trackpad.cancel();
    expect(onScaleCancel).toHaveBeenCalledTimes(1);

    element.dispatchEvent(wheelPinchEvent({deltaY: -50}));
    window.dispatchEvent(new Event('blur'));
    expect(onScaleCancel).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(300);
    expect(onScaleEnd).not.toHaveBeenCalled();
    trackpad.destroy();

    const onEndAfterDestroy = vi.fn();
    const selfDestroying = new TrackpadScale(element, {
      onScale: () => selfDestroying.destroy(),
      onScaleEnd: onEndAfterDestroy,
    });
    element.dispatchEvent(wheelPinchEvent({deltaY: -100}));
    vi.advanceTimersByTime(300);
    expect(onEndAfterDestroy).not.toHaveBeenCalled();
  });

  it('respects ignoreTarget, nested propagate, overflow guards, and destroy cleanup', () => {
    const input = document.createElement('input');
    const inner = document.createElement('div');
    element.append(input, inner);

    const onOuter = vi.fn();
    const onInner = vi.fn();
    const outerTp = new TrackpadScale(element, {onScale: onOuter});
    const innerTp = new TrackpadScale(inner, {onScale: onInner});

    // Form control ignored by default
    input.dispatchEvent(wheelPinchEvent({deltaY: -100}));
    expect(onOuter).not.toHaveBeenCalled();

    // Extreme overflow delta safely prevented without emitting
    const huge = wheelPinchEvent({deltaY: -1_000_000});
    element.dispatchEvent(huge);
    expect(huge.defaultPrevented).toBe(true);
    expect(onOuter).not.toHaveBeenCalled();

    // Nested coordination (propagate: false)
    inner.dispatchEvent(wheelPinchEvent({deltaY: -100}));
    expect(onInner).toHaveBeenCalledTimes(1);
    expect(onOuter).not.toHaveBeenCalled();
    innerTp.destroy();

    // Nested coordination (propagate: true)
    const propInner = new TrackpadScale(inner, {propagate: true, onScale: onInner});
    inner.dispatchEvent(wheelPinchEvent({deltaY: -100}));
    expect(onInner).toHaveBeenCalledTimes(2);
    expect(onOuter).toHaveBeenCalledTimes(1);
    propInner.destroy();
    outerTp.destroy();

    // Destroyed instance stops listening
    const afterDestroy = wheelPinchEvent({deltaY: -100});
    element.dispatchEvent(afterDestroy);
    expect(afterDestroy.defaultPrevented).toBe(false);
  });
});

import {doubleTap, gesture, GestureRecognizer, longPress, pan, swipe, tap} from '@gestures/core';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GestureBinding} from '../src/binding.js';

function pointerEvent(
  type: string,
  init: {pointerId?: number; clientX?: number; clientY?: number; timeStamp?: number} = {}
): PointerEvent {
  const ev = new Event(type, {bubbles: true, cancelable: true, composed: true}) as PointerEvent;
  Object.defineProperties(ev, {
    pointerId: {value: init.pointerId ?? 1},
    clientX: {value: init.clientX ?? 0},
    clientY: {value: init.clientY ?? 0},
    pointerType: {value: 'touch'},
    button: {value: 0},
    ctrlKey: {value: false},
    isPrimary: {value: true},
    ...(init.timeStamp !== undefined ? {timeStamp: {value: init.timeStamp}} : {}),
  });
  return ev;
}

describe('@gestures/react GestureBinding', () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
  });

  it('hot-swaps custom gesture() callbacks and recreates on structural config change', () => {
    class InstantPressRecognizer extends GestureRecognizer {
      constructor(
        private readonly callbacks: {onPress?: (tag: string) => void},
        private readonly tag: string
      ) {
        super();
      }

      protected override onDown(): void {
        this.tryRecognizeDiscrete(() => {
          this.callbacks.onPress?.(this.tag);
        });
      }
    }

    const calls: string[] = [];
    let label = 'v1';
    const makeGestures = (tag: string) => {
      const custom = gesture(
        cbs => new InstantPressRecognizer(cbs, tag),
        {onPress: t => calls.push(`${t}:${label}`)},
        {tag}
      );
      const t = tap({onTap: () => calls.push(`tap:${label}`)}).simultaneousWith(custom);
      return [custom, t];
    };

    const binding = new GestureBinding(element, makeGestures('a'));
    element.dispatchEvent(pointerEvent('pointerdown', {pointerId: 1, clientX: 10, timeStamp: 0}));
    document.dispatchEvent(pointerEvent('pointerup', {pointerId: 1, clientX: 10, timeStamp: 20}));
    expect(calls).toEqual(['a:v1', 'tap:v1']);

    const instBefore = binding.instance;
    label = 'v2';
    binding.update(makeGestures('a'));
    expect(binding.instance).toBe(instBefore);

    element.dispatchEvent(pointerEvent('pointerdown', {pointerId: 2, clientX: 10, timeStamp: 100}));
    document.dispatchEvent(pointerEvent('pointerup', {pointerId: 2, clientX: 10, timeStamp: 120}));
    expect(calls).toEqual(['a:v1', 'tap:v1', 'a:v2', 'tap:v2']);

    binding.update(makeGestures('b'));
    expect(binding.instance).not.toBe(instBefore);

    element.dispatchEvent(pointerEvent('pointerdown', {pointerId: 3, clientX: 10, timeStamp: 200}));
    document.dispatchEvent(pointerEvent('pointerup', {pointerId: 3, clientX: 10, timeStamp: 220}));
    expect(calls).toEqual(['a:v1', 'tap:v1', 'a:v2', 'tap:v2', 'b:v2', 'tap:v2']);

    binding.destroy();
  });

  it('preserves active gestures across callback/relationship updates and recreates on structural changes', () => {
    const onPanCancel = vi.fn();
    const onPanEnd = vi.fn();
    const seen: Array<{step: number; deltaX: number}> = [];

    let step = 0;
    const makeList = (slop: number, includeSwipe = false) => {
      const current = step;
      const hold = longPress({duration: 500, slop: 4, onLongPress: () => {}});
      const drag = pan({
        slop,
        onPan: ev => {
          seen.push({step: current, deltaX: ev.deltaX});
          step++;
          binding.update(makeList(slop, includeSwipe));
        },
        onPanEnd,
        onPanCancel,
        ...(includeSwipe ? {onSwipe: () => {}} : {}),
      }).requireFailureOf(hold);
      return [hold, drag];
    };

    const binding = new GestureBinding(element, makeList(4));
    const initial = binding.instance;

    element.dispatchEvent(pointerEvent('pointerdown', {pointerId: 1, clientX: 0, timeStamp: 0}));
    document.dispatchEvent(pointerEvent('pointermove', {pointerId: 1, clientX: 24, timeStamp: 16}));
    document.dispatchEvent(pointerEvent('pointermove', {pointerId: 1, clientX: 44, timeStamp: 32}));
    document.dispatchEvent(pointerEvent('pointerup', {pointerId: 1, clientX: 44, timeStamp: 48}));

    expect(binding.instance).toBe(initial);
    expect(onPanCancel).not.toHaveBeenCalled();
    expect(onPanEnd).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([
      {step: 0, deltaX: 20},
      {step: 1, deltaX: 40},
    ]);

    binding.update(makeList(4, true));
    expect(binding.instance).not.toBe(initial);

    const afterToggle = binding.instance;
    binding.update(makeList(12, true));
    expect(binding.instance).not.toBe(afterToggle);

    binding.cancel();
    binding.destroy();
    binding.destroy();
    binding.update(makeList(12, true));
    expect(binding.instance).toBeNull();
  });

  it('diffs array options, relationship changes, ignoreTarget transitions, enabled, and propagate', () => {
    const inp = document.createElement('input');
    const blocked = document.createElement('span');
    blocked.dataset.ignore = '1';
    element.append(inp, blocked);

    let tag = 'first';
    const seen: string[] = [];
    const onTap = () => seen.push(tag);

    const binding = new GestureBinding(element, [tap({onTap})], {
      supportedPointerTypes: ['touch', 'mouse'],
      ignoreTarget: true,
    });
    const m1 = binding.instance;

    binding.update([tap({onTap})], {
      supportedPointerTypes: ['touch', 'mouse'],
      ignoreTarget: true,
    });
    expect(binding.instance).toBe(m1);

    binding.update([tap({onTap})], {
      supportedPointerTypes: ['touch'],
      ignoreTarget: true,
    });
    expect(binding.instance).not.toBe(m1);
    const m2 = binding.instance;

    tag = 'second';
    binding.update([tap({onTap: () => seen.push(tag)})], {
      supportedPointerTypes: ['touch'],
      ignoreTarget: true,
    });
    expect(binding.instance).toBe(m2);

    const doTap = (target: HTMLElement, t: number) => {
      target.dispatchEvent(pointerEvent('pointerdown', {clientX: 5, clientY: 5, timeStamp: t}));
      target.dispatchEvent(pointerEvent('pointerup', {clientX: 5, clientY: 5, timeStamp: t + 20}));
    };
    doTap(inp, 0);
    doTap(blocked, 50);
    expect(seen).toEqual(['second']);

    binding.update([tap({onTap})], {
      supportedPointerTypes: ['touch'],
      ignoreTarget: target => target instanceof Element && Boolean(target.closest('[data-ignore]')),
    });
    expect(binding.instance).not.toBe(m2);
    const m3 = binding.instance;

    binding.update([tap({onTap})], {
      supportedPointerTypes: ['touch'],
      ignoreTarget: target => target instanceof Element && Boolean(target.closest('[data-ignore]')),
    });
    expect(binding.instance).toBe(m3);

    doTap(blocked, 100);
    doTap(inp, 150);
    expect(seen).toEqual(['second', 'second']);

    const a = tap({onTap});
    const b = doubleTap({onTap});
    binding.update([a, b], {autoWire: false});
    const m4 = binding.instance;
    const a2 = tap({onTap});
    const b2 = doubleTap({onTap});
    a2.requireFailureOf(b2);
    binding.update([a2, b2], {autoWire: false});
    expect(binding.instance).not.toBe(m4);

    // `NaN` configs remain structurally equal:
    binding.update([tap({onTap: () => {}, slop: Number.NaN})]);
    const m5 = binding.instance;
    binding.update([tap({onTap: () => {}, slop: Number.NaN})]);
    expect(binding.instance).toBe(m5);

    // `enabled: false` tears down cleanly and `propagate` triggers remount:
    const onSwipe = vi.fn();
    binding.update([swipe({direction: 'horizontal', onSwipe})], {enabled: false});
    expect(binding.instance).toBeNull();
    binding.update([swipe({direction: 'horizontal', onSwipe})], {enabled: false});
    expect(binding.instance).toBeNull();

    binding.update([swipe({direction: 'horizontal', onSwipe})], {enabled: true});
    const enabledInst = binding.instance;
    expect(enabledInst).not.toBeNull();
    binding.update([swipe({direction: 'horizontal', onSwipe})], {enabled: true, propagate: true});
    expect(binding.instance).not.toBe(enabledInst);

    binding.destroy();
  });
});

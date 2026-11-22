import {
  Gestures,
  type GestureDescriptor,
  type GesturesOptions,
  type GestureTargetElement,
} from '@gestures/core';

const FN = Symbol('fn');

function snapshot(value: unknown): unknown {
  if (typeof value === 'function') return FN;
  if (Array.isArray(value)) return value.map(snapshot);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = snapshot(v);
    }
    return out;
  }
  return value;
}

function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => same(v, b[i]));
  }
  if (
    a &&
    b &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const ka = Object.keys(a as Record<string, unknown>);
    const kb = Object.keys(b as Record<string, unknown>);
    return (
      ka.length === kb.length &&
      ka.every(
        k =>
          k in (b as Record<string, unknown>) &&
          same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
      )
    );
  }
  return false;
}

function snapshotBinding(descriptors: readonly GestureDescriptor[], options: GesturesOptions) {
  return {
    enabled: options.enabled !== false,
    touchAction: options.touchAction ?? 'compute',
    autoWire: options.autoWire !== false,
    propagate: options.propagate ?? false,
    supportedPointerTypes: snapshot(options.supportedPointerTypes),
    ignoreTarget: snapshot(options.ignoreTarget ?? true),
    gestures: descriptors.map(d => ({
      kind: d.kind,
      config: snapshot(d.config),
      callbacks: Object.keys(d.callbacks)
        .filter(k => typeof d.callbacks[k] === 'function')
        .sort(),
      sim: d.simultaneousPeers.map(p => descriptors.indexOf(p)),
      fail: d.requiredFailures.map(p => descriptors.indexOf(p)),
    })),
  };
}

function proxyDescriptors(
  descriptors: readonly GestureDescriptor[],
  getLatest: () => readonly GestureDescriptor[]
): GestureDescriptor[] {
  const map = new Map<GestureDescriptor, GestureDescriptor>();
  const wrapped = descriptors.map((desc, index) => {
    const callbacks: Record<string, ((...args: never[]) => unknown) | undefined> = {};
    for (const key of Object.keys(desc.callbacks)) {
      if (typeof desc.callbacks[key] === 'function') {
        callbacks[key] = (...args: never[]) => {
          const fn = getLatest()[index]?.callbacks[key];
          return typeof fn === 'function' ? fn(...args) : undefined;
        };
      }
    }
    const proxy: GestureDescriptor = Object.assign(Object.create(desc), {
      callbacks,
      simultaneousPeers: [] as GestureDescriptor[],
      requiredFailures: [] as GestureDescriptor[],
    });
    map.set(desc, proxy);
    return proxy;
  });

  for (let i = 0; i < descriptors.length; i++) {
    (wrapped[i].simultaneousPeers as GestureDescriptor[]).push(
      ...descriptors[i].simultaneousPeers.map(p => map.get(p) ?? p)
    );
    (wrapped[i].requiredFailures as GestureDescriptor[]).push(
      ...descriptors[i].requiredFailures.map(p => map.get(p) ?? p)
    );
  }
  return wrapped;
}

/**
 * Reactive lifecycle controller for `@gestures/react` that hot-swaps inline callbacks
 * without tearing down active gestures and remounts `Gestures` only on structural changes.
 */
export class GestureBinding<T extends GestureTargetElement = GestureTargetElement> {
  readonly element: T;
  private current: Gestures<T> | null = null;
  private latestGestures: readonly GestureDescriptor[];
  private latestOptions: GesturesOptions;
  private mountedSnapshot: unknown = null;
  private destroyed = false;

  constructor(
    element: T,
    gestures: readonly GestureDescriptor[] = [],
    options: GesturesOptions = {}
  ) {
    this.element = element;
    this.latestGestures = gestures;
    this.latestOptions = options;
    this.mount();
  }

  get instance(): Gestures<T> | null {
    return this.current;
  }

  update(gestures: readonly GestureDescriptor[], options: GesturesOptions = {}): void {
    this.latestGestures = gestures;
    this.latestOptions = options;
    if (this.destroyed) return;
    const next = snapshotBinding(gestures, options);
    if (this.mountedSnapshot && same(this.mountedSnapshot, next)) return;
    this.current?.destroy();
    this.current = null;
    this.mount(next);
  }

  cancel(): void {
    this.current?.cancel();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.current?.destroy();
    this.current = null;
    this.mountedSnapshot = null;
  }

  private mount(snap = snapshotBinding(this.latestGestures, this.latestOptions)): void {
    const options = this.latestOptions;
    this.mountedSnapshot = snap;
    if (options.enabled === false) {
      this.current = null;
      return;
    }

    const proxied = proxyDescriptors(this.latestGestures, () => this.latestGestures);
    const ignoreTarget =
      typeof options.ignoreTarget === 'function'
        ? (target: EventTarget, event: Event) => {
            const pred = this.latestOptions.ignoreTarget;
            return typeof pred === 'function' ? pred(target, event) : Boolean(pred ?? true);
          }
        : options.ignoreTarget;

    this.current = new Gestures(this.element, proxied, {
      supportedPointerTypes: options.supportedPointerTypes,
      touchAction: options.touchAction,
      autoWire: options.autoWire,
      ignoreTarget,
      propagate: options.propagate,
    });
  }
}

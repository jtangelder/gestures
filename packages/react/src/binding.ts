import {
  Gestures,
  type GestureDescriptor,
  type GesturesOptions,
  type GestureTargetElement,
  type TouchActionSetting,
} from '@gestures/core';

const FN_SENTINEL = Symbol('fn');

function snapshotStructure(value: unknown): unknown {
  if (typeof value === 'function') {
    return FN_SENTINEL;
  }
  if (Array.isArray(value)) {
    return value.map(snapshotStructure);
  }
  if (value !== null && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        copy[k] = snapshotStructure(v);
      }
    }
    return copy;
  }
  return value;
}

function matchesSnapshot(snapshot: unknown, live: unknown): boolean {
  if (snapshot === FN_SENTINEL) {
    return typeof live === 'function';
  }
  if (typeof live === 'function') {
    return false;
  }
  if (Object.is(snapshot, live)) {
    return true;
  }
  if (Array.isArray(snapshot)) {
    return (
      Array.isArray(live) &&
      snapshot.length === live.length &&
      snapshot.every((item, i) => matchesSnapshot(item, live[i]))
    );
  }
  if (
    snapshot !== null &&
    live !== null &&
    typeof snapshot === 'object' &&
    typeof live === 'object' &&
    !Array.isArray(live)
  ) {
    const snapObj = snapshot as Record<string, unknown>;
    const liveObj = live as Record<string, unknown>;
    const snapKeys = Object.keys(snapObj);
    let liveCount = 0;
    for (const k of Object.keys(liveObj)) {
      if (liveObj[k] !== undefined) {
        liveCount++;
      }
    }
    return (
      snapKeys.length === liveCount &&
      snapKeys.every(k => liveObj[k] !== undefined && matchesSnapshot(snapObj[k], liveObj[k]))
    );
  }
  return false;
}

interface BindingSnapshot {
  readonly enabled: boolean;
  readonly touchAction: TouchActionSetting;
  readonly autoWire: boolean;
  readonly propagate: boolean;
  readonly supportedPointerTypes: unknown;
  readonly ignoreTarget: unknown;
  readonly gestures: ReadonlyArray<{
    readonly kind: GestureDescriptor['kind'];
    readonly config: unknown;
    readonly callbackKeys: readonly string[];
    readonly simIndices: readonly number[];
    readonly failIndices: readonly number[];
  }>;
}

function snapshotBinding(
  descriptors: readonly GestureDescriptor[],
  options: GesturesOptions
): BindingSnapshot {
  return {
    enabled: options.enabled !== false,
    touchAction: options.touchAction ?? 'compute',
    autoWire: options.autoWire !== false,
    propagate: options.propagate ?? false,
    supportedPointerTypes: snapshotStructure(options.supportedPointerTypes),
    ignoreTarget: snapshotStructure(options.ignoreTarget ?? true),
    gestures: descriptors.map(d => ({
      kind: d.kind,
      config: snapshotStructure(d.config),
      callbackKeys: Object.keys(d.callbacks).filter(k => typeof d.callbacks[k] === 'function'),
      simIndices: d.simultaneousPeers.map(p => descriptors.indexOf(p)),
      failIndices: d.requiredFailures.map(p => descriptors.indexOf(p)),
    })),
  };
}

function matchesBinding(
  snap: BindingSnapshot,
  descriptors: readonly GestureDescriptor[],
  options: GesturesOptions
): boolean {
  if (
    snap.enabled !== (options.enabled !== false) ||
    snap.touchAction !== (options.touchAction ?? 'compute') ||
    snap.autoWire !== (options.autoWire !== false) ||
    snap.propagate !== (options.propagate ?? false) ||
    snap.gestures.length !== descriptors.length ||
    !matchesSnapshot(snap.supportedPointerTypes, options.supportedPointerTypes) ||
    !matchesSnapshot(snap.ignoreTarget, options.ignoreTarget ?? true)
  ) {
    return false;
  }
  for (let i = 0; i < descriptors.length; i++) {
    const s = snap.gestures[i];
    const d = descriptors[i];
    if (
      s.kind !== d.kind ||
      !matchesSnapshot(s.config, d.config) ||
      s.simIndices.length !== d.simultaneousPeers.length ||
      s.failIndices.length !== d.requiredFailures.length ||
      !s.simIndices.every((idx, j) => idx === descriptors.indexOf(d.simultaneousPeers[j])) ||
      !s.failIndices.every((idx, j) => idx === descriptors.indexOf(d.requiredFailures[j]))
    ) {
      return false;
    }
    let liveCbCount = 0;
    for (const k of Object.keys(d.callbacks)) {
      if (typeof d.callbacks[k] === 'function') {
        liveCbCount++;
      }
    }
    if (
      s.callbackKeys.length !== liveCbCount ||
      !s.callbackKeys.every(k => typeof d.callbacks[k] === 'function')
    ) {
      return false;
    }
  }
  return true;
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
    const src = descriptors[i];
    const dst = wrapped[i];
    (dst.simultaneousPeers as GestureDescriptor[]).push(
      ...src.simultaneousPeers.map(p => map.get(p) ?? p)
    );
    (dst.requiredFailures as GestureDescriptor[]).push(
      ...src.requiredFailures.map(p => map.get(p) ?? p)
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
  private mountedSnapshot: BindingSnapshot | null = null;
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
    if (this.destroyed) {
      return;
    }
    if (this.mountedSnapshot && matchesBinding(this.mountedSnapshot, gestures, options)) {
      return;
    }
    this.current?.destroy();
    this.current = null;
    this.mount();
  }

  cancel(): void {
    this.current?.cancel();
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.current?.destroy();
    this.current = null;
    this.mountedSnapshot = null;
  }

  private mount(): void {
    const gestures = this.latestGestures;
    const options = this.latestOptions;
    this.mountedSnapshot = snapshotBinding(gestures, options);

    if (options.enabled === false) {
      this.current = null;
      return;
    }

    const proxied = proxyDescriptors(gestures, () => this.latestGestures);
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

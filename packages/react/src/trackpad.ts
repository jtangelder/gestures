import {
  TrackpadScale,
  type TrackpadScaleEvent,
  type TrackpadScaleOptions,
  type TrackpadTargetElement,
} from '@gestures/trackpad';
import {useEffect, useRef, useState, type RefCallback} from 'react';

export type {TrackpadScaleEvent, TrackpadScaleOptions, TrackpadTargetElement};

/**
 * React hook for standalone laptop trackpad pinch-to-zoom (`@gestures/trackpad`).
 *
 * Inline callbacks hot-swap without recreating listeners or cancelling active pinches.
 */
export function useTrackpadScale<T extends TrackpadTargetElement = HTMLElement>(
  options: TrackpadScaleOptions = {}
): RefCallback<T> {
  const [element, setElement] = useState<T | null>(null);
  const latestRef = useRef(options);
  useEffect(() => {
    latestRef.current = options;
  });

  const {enabled, sensitivity, endTimeout, propagate} = options;
  const ignoreMode =
    typeof options.ignoreTarget === 'function' ? 'fn' : (options.ignoreTarget ?? true);

  useEffect(() => {
    if (!element || enabled === false) {
      return;
    }
    const instance = new TrackpadScale(element, {
      enabled,
      sensitivity,
      endTimeout,
      propagate,
      ignoreTarget:
        ignoreMode === 'fn'
          ? (target, event) => {
              const pred = latestRef.current.ignoreTarget;
              return typeof pred === 'function' ? pred(target, event) : Boolean(pred ?? true);
            }
          : ignoreMode,
      onScaleStart: ev => latestRef.current.onScaleStart?.(ev),
      onScale: ev => latestRef.current.onScale?.(ev),
      onScaleEnd: ev => latestRef.current.onScaleEnd?.(ev),
      onScaleCancel: () => latestRef.current.onScaleCancel?.(),
    });
    return () => instance.destroy();
  }, [element, enabled, sensitivity, endTimeout, propagate, ignoreMode]);

  return setElement;
}

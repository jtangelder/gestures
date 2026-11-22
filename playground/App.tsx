import {
  doubleTap,
  longPress,
  pan,
  quickScale,
  rotate,
  scale,
  tap,
  type GestureDescriptor,
  type GestureEventData,
  type LongPressEventData,
  type MotionEvent,
  type PanEventData,
  type PointerType,
  type RotateEventData,
  type ScaleEventData,
  type SwipeEventData,
} from '@gestures/core';
import {useGestures} from '@gestures/react';
import {TrackpadScale, type TrackpadScaleEvent} from '@gestures/trackpad';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  BASE_CONFIG,
  INITIAL_TELEMETRY,
  INITIAL_TRANSFORM,
  PRESETS,
  readEnvRows,
  round,
  type Config,
  type LogEntry,
  type Telemetry,
  type Transform,
  type VisualPointer,
} from './config';
import {ConfigPanel} from './ConfigPanel';
import {EventLog} from './EventLog';
import {PointerOverlay} from './PointerOverlay';

const MAX_LOGS = 200;

export function App() {
  const [config, setConfig] = useState<Config>(BASE_CONFIG);
  const [persist, setPersist] = useState(false);
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const [appliedTouchAction, setAppliedTouchAction] = useState('none');
  const [transform, setTransform] = useState<Transform>(INITIAL_TRANSFORM);
  const [gestureLabel, setGestureLabel] = useState('Touch, Drag, Pinch, or Rotate');
  const [flashing, setFlashing] = useState(false);
  const [childClicks, setChildClicks] = useState(0);
  const [telemetry, setTelemetry] = useState<Telemetry>(INITIAL_TELEMETRY);
  const [pointers, setPointers] = useState<VisualPointer[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [envRows, setEnvRows] = useState<Array<[string, string]>>(readEnvRows);

  const baseRef = useRef({tx: 0, ty: 0, scale: 1, rot: 0});
  const liveRef = useRef({tx: 0, ty: 0, scale: 1, rot: 0});
  const originRef = useRef({tx: 0, ty: 0, scale: 1, rot: 0});
  const pointerMapRef = useRef(new Map<number, VisualPointer>());
  const trackpadRef = useRef<TrackpadScale | null>(null);
  const swipedRef = useRef(false);
  const statsRef = useRef({count: 0, seq: 0, originTime: performance.now(), peakSpeed: 0});

  const patchConfig = (patch: Partial<Config>, markCustom = true) =>
    setConfig(prev => ({...prev, ...patch, ...(markCustom ? {preset: 'custom'} : {})}));

  const applyTransform = (next: Partial<Transform>, animate = false) => {
    const merged = {...liveRef.current, ...next};
    liveRef.current = merged;
    setTransform({...merged, animate});
  };

  const resetTransform = useCallback((animate = true) => {
    baseRef.current = {tx: 0, ty: 0, scale: 1, rot: 0};
    liveRef.current = {tx: 0, ty: 0, scale: 1, rot: 0};
    setTransform({...INITIAL_TRANSFORM, animate});
  }, []);

  const settleTransform = (swipeVx = 0, swipeVy = 0) => {
    if (persist) {
      const rect = stageEl?.getBoundingClientRect();
      const maxX = Math.max(80, (rect?.width ?? 300) * 0.42);
      const maxY = Math.max(80, (rect?.height ?? 300) * 0.42);
      const clamped = {
        tx: Math.max(-maxX, Math.min(maxX, liveRef.current.tx)),
        ty: Math.max(-maxY, Math.min(maxY, liveRef.current.ty)),
        scale: Math.max(0.35, Math.min(3.5, liveRef.current.scale)),
        rot: liveRef.current.rot,
      };
      baseRef.current = clamped;
      applyTransform(clamped, true);
      return;
    }
    if (swipeVx !== 0 || swipeVy !== 0) {
      applyTransform(
        {
          tx: liveRef.current.tx + Math.max(-48, Math.min(48, swipeVx * 0.035)),
          ty: liveRef.current.ty + Math.max(-48, Math.min(48, swipeVy * 0.035)),
        },
        true
      );
      setTimeout(() => {
        if (pointerMapRef.current.size === 0) resetTransform(true);
      }, 140);
      return;
    }
    if (pointerMapRef.current.size === 0) resetTransform(true);
  };

  const localPoint = (p: {x: number; y: number}) => {
    const rect = stageEl?.getBoundingClientRect();
    return {x: p.x - (rect?.left ?? 0), y: p.y - (rect?.top ?? 0)};
  };

  const appendLog = useCallback((category: LogEntry['category'], name: string, summary: string) => {
    const seq = ++statsRef.current.seq;
    const relMs = Math.max(0, performance.now() - statsRef.current.originTime);
    setLogs(prev => [...prev.slice(-(MAX_LOGS - 1)), {seq, relMs, category, name, summary}]);
  }, []);

  const flashStage = () => {
    setFlashing(true);
    setTimeout(() => setFlashing(false), 160);
  };

  const recordTelemetry = (
    name: string,
    patch: Partial<Telemetry> = {},
    motionEvent?: MotionEvent
  ) => {
    setGestureLabel(name);
    const pointersText = motionEvent
      ? `${motionEvent.activePointerCount} active (${motionEvent.pointerType}) · ${motionEvent.history.length + 1} smp`
      : undefined;
    setTelemetry(prev => ({
      ...prev,
      gesture: `${name} (#${statsRef.current.count})`,
      ...(pointersText ? {pointers: pointersText} : {}),
      ...patch,
    }));
  };

  const makeTapHandler =
    (name: string, extra?: (ev: GestureEventData) => void) => (ev: GestureEventData) => {
      statsRef.current.count++;
      flashStage();
      extra?.(ev);
      const local = localPoint(ev.center);
      recordTelemetry(
        name,
        {delta: `at (${Math.round(local.x)}, ${Math.round(local.y)}) px`},
        ev.motionEvent
      );
      appendLog(
        'lifecycle',
        name,
        `center=(${Math.round(local.x)}, ${Math.round(local.y)}) type=${ev.pointerType}`
      );
    };

  // Shared across 2F `scale()`, 1F `quickScale()`, and standalone `TrackpadScale`
  const makeScaleHandlers = (prefix: string, tag?: string) => ({
    onScaleStart: (ev: ScaleEventData | TrackpadScaleEvent) => {
      statsRef.current.count++;
      originRef.current.scale = baseRef.current.scale;
      const motion = 'motionEvent' in ev ? ev.motionEvent : undefined;
      const scaleText = motion
        ? `${ev.scale.toFixed(2)}×${tag ? ` (${tag})` : ` · span ${Math.round(motion.getSpan())}px`}`
        : `${ev.scale.toFixed(2)}× (${tag})`;
      recordTelemetry(
        `${prefix}Start`,
        {scale: scaleText, ...(!motion ? {pointers: 'trackpad pinch'} : {})},
        motion
      );
      const local = localPoint(ev.center);
      appendLog(
        'lifecycle',
        `${prefix}Start`,
        `center=(${Math.round(local.x)}, ${Math.round(local.y)})`
      );
    },
    onScale: (ev: ScaleEventData | TrackpadScaleEvent) => {
      applyTransform({scale: originRef.current.scale * ev.scale});
      const motion = 'motionEvent' in ev ? ev.motionEvent : undefined;
      const scaleText = motion
        ? `${ev.scale.toFixed(2)}×${tag ? ` (${tag})` : ` · span ${Math.round(motion.getSpan())}px`}`
        : `${ev.scale.toFixed(2)}× (${tag})`;
      recordTelemetry(prefix, {scale: scaleText}, motion);
      appendLog('move', prefix, `scale=${ev.scale.toFixed(3)} factor=${ev.scaleFactor.toFixed(3)}`);
    },
    onScaleEnd: (ev: ScaleEventData | TrackpadScaleEvent) => {
      baseRef.current.scale = liveRef.current.scale;
      recordTelemetry(`${prefix}End`, {}, 'motionEvent' in ev ? ev.motionEvent : undefined);
      appendLog('lifecycle', `${prefix}End`, `finalScale=${ev.scale.toFixed(3)}`);
      settleTransform();
    },
    onScaleCancel: () => {
      appendLog('lifecycle', `${prefix}Cancel`, 'cancelled');
      settleTransform();
    },
  });

  // Declarative `@gestures/core` descriptors bound via `@gestures/react` `useGestures`
  const gestures: GestureDescriptor[] = [];
  const doubleTapDesc = config.enableDoubleTap
    ? doubleTap({
        onTap: makeTapHandler('DoubleTap', () => {
          if (persist) {
            const nextScale = liveRef.current.scale > 1.2 ? 1 : 1.6;
            baseRef.current.scale = nextScale;
            applyTransform({scale: nextScale}, true);
          }
        }),
      })
    : null;

  if (config.enableSingleTap) {
    const label =
      doubleTapDesc && config.requireDoubleTapFailure ? 'SingleTap (Conf)' : 'SingleTap';
    const single = tap({onTap: makeTapHandler(label)});
    if (doubleTapDesc) {
      if (config.requireDoubleTapFailure) single.requireFailureOf(doubleTapDesc);
      else single.simultaneousWith(doubleTapDesc);
    }
    gestures.push(single);
  }
  if (doubleTapDesc) gestures.push(doubleTapDesc);
  if (config.enableTwoFingerTap) {
    gestures.push(tap({numPointers: 2, onTap: makeTapHandler('2FingerTap')}));
  }

  if (config.enableLongPress) {
    gestures.push(
      longPress({
        numPointers: config.longPressPointers,
        onLongPress: (ev: LongPressEventData) => {
          statsRef.current.count++;
          flashStage();
          originRef.current.tx = baseRef.current.tx;
          originRef.current.ty = baseRef.current.ty;
          const local = localPoint(ev.center);
          recordTelemetry(
            'LongPress',
            {delta: `held at (${Math.round(local.x)}, ${Math.round(local.y)}) px`},
            ev.motionEvent
          );
          appendLog(
            'lifecycle',
            'LongPress',
            `ptrs=${config.longPressPointers} center=(${Math.round(local.x)}, ${Math.round(local.y)})`
          );
        },
        onLongPressMove: config.enableLongPressMove
          ? (ev: LongPressEventData) => {
              applyTransform({
                tx: originRef.current.tx + ev.deltaX,
                ty: originRef.current.ty + ev.deltaY,
              });
              recordTelemetry(
                'LongPressMove',
                {delta: `dx=${round(ev.deltaX)} dy=${round(ev.deltaY)} px`},
                ev.motionEvent
              );
              appendLog('move', 'LongPressMove', `dx=${round(ev.deltaX)} dy=${round(ev.deltaY)}`);
            }
          : undefined,
        onLongPressUp: (ev: LongPressEventData) => {
          recordTelemetry('LongPressUp', {}, ev.motionEvent);
          appendLog('lifecycle', 'LongPressUp', `dx=${round(ev.deltaX)} dy=${round(ev.deltaY)}`);
          settleTransform();
        },
        onLongPressCancel: () => {
          appendLog('lifecycle', 'LongPressCancel', 'cancelled');
          settleTransform();
        },
      })
    );
  }

  const scaleDesc = config.enableScale ? scale(makeScaleHandlers('Scale')) : null;
  const rotateDesc = config.enableRotate
    ? rotate({
        onRotateStart: (ev: RotateEventData) => {
          statsRef.current.count++;
          originRef.current.rot = baseRef.current.rot;
          recordTelemetry('RotateStart', {rotation: `${ev.rotation.toFixed(1)}°`}, ev.motionEvent);
          appendLog('lifecycle', 'RotateStart', `span=${round(ev.motionEvent.getSpan())}px`);
        },
        onRotate: (ev: RotateEventData) => {
          applyTransform({rot: originRef.current.rot + ev.rotation});
          recordTelemetry(
            'Rotate',
            {rotation: `${ev.rotation.toFixed(1)}° (Δ${ev.rotationDelta.toFixed(1)}°)`},
            ev.motionEvent
          );
          appendLog('move', 'Rotate', `rot=${ev.rotation.toFixed(1)}°`);
        },
        onRotateEnd: (ev: RotateEventData) => {
          baseRef.current.rot = liveRef.current.rot;
          recordTelemetry('RotateEnd', {}, ev.motionEvent);
          appendLog('lifecycle', 'RotateEnd', `totalRot=${ev.rotation.toFixed(1)}°`);
          settleTransform();
        },
        onRotateCancel: () => {
          appendLog('lifecycle', 'RotateCancel', 'cancelled');
          settleTransform();
        },
      })
    : null;

  if (config.scaleRotateSimultaneous && scaleDesc && rotateDesc) {
    scaleDesc.simultaneousWith(rotateDesc);
    rotateDesc.simultaneousWith(scaleDesc);
  }
  if (scaleDesc) gestures.push(scaleDesc);
  if (rotateDesc) gestures.push(rotateDesc);
  if (config.enableQuickScale) {
    gestures.push(
      quickScale({
        sensitivity: config.quickScaleSensitivity,
        ...makeScaleHandlers('QuickScale', 'quick'),
      })
    );
  }

  if (config.enablePan) {
    const panDesc = pan({
      direction: config.panDirection,
      numPointers: config.panPointers,
      onPanStart: (ev: PanEventData) => {
        statsRef.current.count++;
        swipedRef.current = false;
        statsRef.current.peakSpeed = Math.hypot(ev.velocityX, ev.velocityY);
        originRef.current.tx = baseRef.current.tx;
        originRef.current.ty = baseRef.current.ty;
        recordTelemetry('PanStart', {delta: 'dx=0 dy=0 px'}, ev.motionEvent);
        appendLog(
          'lifecycle',
          'PanStart',
          `ptrs=${ev.motionEvent.activePointerCount} type=${ev.pointerType}`
        );
      },
      onPan: (ev: PanEventData) => {
        const speed = Math.hypot(ev.velocityX, ev.velocityY);
        statsRef.current.peakSpeed = Math.max(statsRef.current.peakSpeed, speed);
        applyTransform({
          tx: originRef.current.tx + ev.deltaX,
          ty: originRef.current.ty + ev.deltaY,
        });
        recordTelemetry(
          'Pan',
          {
            delta: `dx=${round(ev.deltaX)} dy=${round(ev.deltaY)} px`,
            velocity: `${Math.round(speed)} px/s · peak ${Math.round(statsRef.current.peakSpeed)}`,
          },
          ev.motionEvent
        );
        appendLog(
          'move',
          'Pan',
          `dx=${round(ev.deltaX)} dy=${round(ev.deltaY)} speed=${Math.round(speed)}px/s`
        );
      },
      onPanEnd: (ev: PanEventData) => {
        const speed = Math.hypot(ev.velocityX, ev.velocityY);
        baseRef.current.tx = liveRef.current.tx;
        baseRef.current.ty = liveRef.current.ty;
        recordTelemetry(
          'PanEnd',
          {velocity: `${Math.round(speed)} px/s · peak ${Math.round(statsRef.current.peakSpeed)}`},
          ev.motionEvent
        );
        appendLog('lifecycle', 'PanEnd', `dx=${round(ev.deltaX)} dy=${round(ev.deltaY)}`);
        if (!config.enableSwipe) settleTransform();
        else queueMicrotask(() => !swipedRef.current && settleTransform());
      },
      onSwipe: config.enableSwipe
        ? (ev: SwipeEventData) => {
            swipedRef.current = true;
            statsRef.current.count++;
            flashStage();
            const speed = Math.hypot(ev.velocityX, ev.velocityY);
            recordTelemetry(
              `Swipe (${ev.direction})`,
              {velocity: `SWIPE ${ev.direction} · ${Math.round(speed)} px/s`},
              ev.motionEvent
            );
            appendLog('lifecycle', `Swipe:${ev.direction}`, `speed=${Math.round(speed)}px/s`);
            settleTransform(ev.velocityX, ev.velocityY);
          }
        : undefined,
      onPanCancel: () => {
        appendLog('lifecycle', 'PanCancel', 'cancelled');
        settleTransform();
      },
    });
    if (config.panSimultaneousScaleRotate) {
      if (scaleDesc) {
        panDesc.simultaneousWith(scaleDesc);
        scaleDesc.simultaneousWith(panDesc);
      }
      if (rotateDesc) {
        panDesc.simultaneousWith(rotateDesc);
        rotateDesc.simultaneousWith(panDesc);
      }
    }
    gestures.push(panDesc);
  }

  const supportedPointerTypes: PointerType[] = [
    ...(config.pointerTouch ? (['touch'] as const) : []),
    ...(config.pointerPen ? (['pen'] as const) : []),
    ...(config.pointerMouse ? (['mouse'] as const) : []),
  ];

  const gestureRef = useGestures<HTMLDivElement>(gestures, {
    supportedPointerTypes,
    touchAction: config.touchAction,
    autoWire: false,
  });

  const bindStage = useCallback(
    (node: HTMLDivElement | null) => {
      gestureRef(node);
      setStageEl(node);
    },
    [gestureRef]
  );

  useEffect(() => {
    setAppliedTouchAction(stageEl?.style.touchAction || '(unset)');
  }, [stageEl, config]);

  // Attach standalone `@gestures/trackpad` with hot-swapped callbacks
  const trackpadCallbacksRef = useRef(makeScaleHandlers('Trackpad', 'trackpad'));
  trackpadCallbacksRef.current = makeScaleHandlers('Trackpad', 'trackpad');

  useEffect(() => {
    if (!stageEl || !config.enableTrackpadScale || !config.pointerMouse) return;
    const tp = new TrackpadScale(stageEl, {
      onScaleStart: ev => trackpadCallbacksRef.current.onScaleStart(ev),
      onScale: ev => trackpadCallbacksRef.current.onScale(ev),
      onScaleEnd: ev => trackpadCallbacksRef.current.onScaleEnd(ev),
      onScaleCancel: () => trackpadCallbacksRef.current.onScaleCancel(),
    });
    trackpadRef.current = tp;
    return () => {
      tp.destroy();
      trackpadRef.current = null;
    };
  }, [stageEl, config.enableTrackpadScale, config.pointerMouse]);

  // Passive visual pointer overlay & raw DOM log diagnostics
  useEffect(() => {
    if (!stageEl) return;
    const sync = () => setPointers(Array.from(pointerMapRef.current.values()));
    const setPtr = (e: PointerEvent) => {
      pointerMapRef.current.set(e.pointerId, {
        id: e.pointerId,
        type: e.pointerType || 'touch',
        x: e.clientX,
        y: e.clientY,
        pressure: typeof e.pressure === 'number' ? e.pressure : 0.5,
      });
      sync();
    };
    const onDown = (e: PointerEvent) => {
      trackpadRef.current?.cancel();
      if (pointerMapRef.current.size === 0) statsRef.current.originTime = performance.now();
      setPtr(e);
      appendLog('dom', 'pointerdown', `id=${e.pointerId} type=${e.pointerType}`);
    };
    const onMove = (e: PointerEvent) => pointerMapRef.current.has(e.pointerId) && setPtr(e);
    const onEnd = (type: 'pointerup' | 'pointercancel') => (e: PointerEvent) => {
      if (!pointerMapRef.current.delete(e.pointerId)) return;
      sync();
      appendLog('dom', type, `id=${e.pointerId} remaining=${pointerMapRef.current.size}`);
    };
    const onUp = onEnd('pointerup');
    const onCancel = onEnd('pointercancel');

    stageEl.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    return () => {
      stageEl.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
    };
  }, [stageEl, appendLog]);

  useEffect(() => {
    const onResize = () => setEnvRows(readEnvRows());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <>
      <header className="container">
        <nav aria-label="Playground toolbar">
          <h1>Gestures Playground</h1>
          <div className="inline-row">
            <select
              id="presetSelect"
              aria-label="Configuration preset"
              value={config.preset}
              onChange={e => {
                const preset = e.target.value;
                setConfig(prev => ({
                  ...BASE_CONFIG,
                  pointerTouch: prev.pointerTouch,
                  pointerPen: prev.pointerPen,
                  pointerMouse: prev.pointerMouse,
                  ...(PRESETS[preset]?.patch ?? {}),
                  preset,
                }));
                resetTransform(true);
              }}
            >
              {Object.entries(PRESETS).map(([key, {label}]) => (
                <option key={key} value={key}>
                  Preset: {label}
                </option>
              ))}
              {config.preset === 'custom' && <option value="custom">Preset: Custom</option>}
            </select>
            <button
              type="button"
              className="secondary outline"
              onClick={() => {
                setConfig(BASE_CONFIG);
                setChildClicks(0);
                resetTransform(true);
              }}
            >
              Reset
            </button>
          </div>
        </nav>
      </header>

      <main className="container">
        <div className="playground-grid">
          <section aria-label="Gesture test surface and event log">
            <article className="stage-host">
              <header>
                <h2>Gesture Stage</h2>
                <div className="inline-row">
                  <label htmlFor="persistToggle">
                    <input
                      id="persistToggle"
                      type="checkbox"
                      role="switch"
                      checked={persist}
                      onChange={e => {
                        setPersist(e.target.checked);
                        if (!e.target.checked) resetTransform(true);
                      }}
                    />
                    Persist
                  </label>
                  <button
                    type="button"
                    className="secondary outline"
                    onClick={() => resetTransform(true)}
                  >
                    Center
                  </button>
                </div>
              </header>

              <div id="hitarea" ref={bindStage} data-flash={flashing ? 'true' : undefined}>
                <PointerOverlay stageEl={stageEl} pointers={pointers} />
                <div
                  id="transformCard"
                  className={transform.animate ? 'spring-back' : undefined}
                  style={{
                    transform: `translate3d(${round(transform.tx)}px, ${round(transform.ty)}px, 0) scale(${round(transform.scale, 3)}) rotate(${round(transform.rot)}deg)`,
                  }}
                >
                  <strong>{gestureLabel}</strong>
                  <span className="transform-meta">
                    ({Math.round(transform.tx)}, {Math.round(transform.ty)})px ·{' '}
                    {transform.scale.toFixed(2)}× · {transform.rot.toFixed(1)}°
                  </span>
                  <button
                    id="childButton"
                    type="button"
                    className="contrast"
                    onClick={() => {
                      const next = childClicks + 1;
                      setChildClicks(next);
                      appendLog('lifecycle', 'ChildButtonClick', `Native click #${next}`);
                    }}
                  >
                    Child Button (<span id="childClickCount">{childClicks}</span> clicks)
                  </button>
                </div>
              </div>

              <p className="surface-meta">
                Applied <code>style.touchAction</code>: <code>{appliedTouchAction}</code> · Powered
                by <code>@gestures/react</code> + <code>@gestures/trackpad</code>
              </p>

              <dl className="telemetry-grid">
                <div>
                  <dt>Last Gesture</dt>
                  <dd>{telemetry.gesture}</dd>
                </div>
                <div>
                  <dt>Pointers</dt>
                  <dd>{telemetry.pointers}</dd>
                </div>
                <div>
                  <dt>Delta / Pos</dt>
                  <dd>{telemetry.delta}</dd>
                </div>
                <div>
                  <dt>Velocity</dt>
                  <dd>{telemetry.velocity}</dd>
                </div>
                <div>
                  <dt>Scale</dt>
                  <dd>{telemetry.scale}</dd>
                </div>
                <div>
                  <dt>Rotation</dt>
                  <dd>{telemetry.rotation}</dd>
                </div>
              </dl>
            </article>

            <EventLog logs={logs} onClear={() => setLogs([])} />
          </section>

          <section aria-label="Configuration and diagnostics">
            <ConfigPanel config={config} envRows={envRows} onPatch={patchConfig} />
          </section>
        </div>
      </main>

      <footer className="container">
        <p>
          <strong>Cross-device tips:</strong> Run <code>npm run dev -- --host</code> to test on
          Android, iPhone, or iPad over Wi-Fi. Try <em>Horizontal Carousel</em> or{' '}
          <em>Feed Card</em> to test native vertical scroll coexistence, or tap/drag{' '}
          <strong>Child Button</strong> to test click preservation and ghost-click suppression.
        </p>
      </footer>
    </>
  );
}

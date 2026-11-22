import {doubleTap, longPress, pan, quickScale, rotate, scale, tap} from '@gestures/core';
import {useGestures} from '@gestures/react';
import {TrackpadScale} from '@gestures/trackpad';
import {useCallback, useEffect, useRef, useState} from 'react';
import {CodeExamples} from './CodeExamples';
import {round} from './config';

interface DemoTransform {
  tx: number;
  ty: number;
  scale: number;
  rot: number;
  spring: boolean;
}

const REST_TRANSFORM: DemoTransform = {tx: 0, ty: 0, scale: 1, rot: 0, spring: true};

const FEATURES: ReadonlyArray<{title: string; body: string}> = [
  {
    title: 'W3C Pointer Events',
    body: 'Unified touch, pen, and mouse input with progressive getCoalescedEvents() sampling, polynomial velocity tracking, and an order-independent GestureArena.',
  },
  {
    title: 'Broad Browser Support',
    body: 'Runs on iOS & iPadOS 13+, Android 5.0+ (Chrome & WebView), and every modern desktop browser — with progressive feature detection for newer APIs.',
  },
  {
    title: 'Tree-Shakable & Lightweight',
    body: 'Import only what you use — ~7.2 kB gzipped for tap up to ~12.3 kB for every recognizer — with smart default relationships auto-wired.',
  },
  {
    title: 'Standalone Trackpad Pinch',
    body: 'Opt-in @gestures/trackpad handles ctrl+wheel and macOS Safari GestureEvent pinch-to-zoom.',
  },
];

function HeroDemo() {
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<DemoTransform>(REST_TRANSFORM);
  const [status, setStatus] = useState('Try tapping, dragging, pinching, or rotating');
  const [flashing, setFlashing] = useState(false);

  const activePointersRef = useRef(0);
  const liveRef = useRef({tx: 0, ty: 0, scale: 1, rot: 0});
  const swipedRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackpadRef = useRef<TrackpadScale | null>(null);

  const clearTimer = () => {
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const resetCard = useCallback(() => {
    clearTimer();
    liveRef.current = {tx: 0, ty: 0, scale: 1, rot: 0};
    setTransform(REST_TRANSFORM);
  }, []);

  const updateCard = (patch: Partial<typeof liveRef.current>, spring = false) => {
    liveRef.current = {...liveRef.current, ...patch};
    setTransform({...liveRef.current, spring});
  };

  const flash = () => {
    setFlashing(true);
    setTimeout(() => setFlashing(false), 180);
  };

  const gestureRef = useGestures<HTMLDivElement>([
    tap({
      onTap: ev => {
        flash();
        setStatus(`Tap (${ev.pointerType})`);
      },
    }),
    doubleTap({
      onTap: ev => {
        flash();
        setStatus(`Double Tap (${ev.pointerType})`);
      },
    }),
    longPress({
      onLongPress: ev => {
        flash();
        setStatus(`Long Press (${ev.pointerType})`);
      },
    }),
    pan({
      numPointers: 0,
      onPanStart: () => {
        swipedRef.current = false;
        clearTimer();
      },
      onPan: ev => {
        updateCard({tx: ev.deltaX, ty: ev.deltaY});
        setStatus(`Pan (${Math.round(ev.deltaX)}, ${Math.round(ev.deltaY)})px`);
      },
      onPanEnd: () => {
        queueMicrotask(() => {
          if (!swipedRef.current && activePointersRef.current === 0) resetCard();
        });
      },
      onSwipe: ev => {
        swipedRef.current = true;
        flash();
        setStatus(
          `Swipe ${ev.direction} · ${Math.round(Math.hypot(ev.velocityX, ev.velocityY))} px/s`
        );
        updateCard(
          {
            tx: liveRef.current.tx + Math.max(-44, Math.min(44, ev.velocityX * 0.03)),
            ty: liveRef.current.ty + Math.max(-44, Math.min(44, ev.velocityY * 0.03)),
          },
          true
        );
        clearTimer();
        resetTimerRef.current = setTimeout(() => {
          resetTimerRef.current = null;
          if (activePointersRef.current === 0) resetCard();
        }, 160);
      },
      onPanCancel: resetCard,
    }),
    scale({
      onScale: ev => {
        updateCard({scale: ev.scale});
        setStatus(`Pinch Scale ${ev.scale.toFixed(2)}×`);
      },
      onScaleEnd: () => {
        if (activePointersRef.current === 0) resetCard();
      },
      onScaleCancel: resetCard,
    }),
    quickScale({
      onScale: ev => {
        updateCard({scale: ev.scale});
        setStatus(`Quick Scale ${ev.scale.toFixed(2)}×`);
      },
      onScaleEnd: resetCard,
      onScaleCancel: resetCard,
    }),
    rotate({
      onRotate: ev => {
        updateCard({rot: ev.rotation});
        setStatus(`Rotate ${ev.rotation.toFixed(1)}°`);
      },
      onRotateEnd: () => {
        if (activePointersRef.current === 0) resetCard();
      },
      onRotateCancel: resetCard,
    }),
  ]);

  const bindStage = useCallback(
    (node: HTMLDivElement | null) => {
      gestureRef(node);
      setStageEl(node);
    },
    [gestureRef]
  );

  // Track pointer count so multi-touch rotate/scale springs back once the final finger lifts
  useEffect(() => {
    if (!stageEl) return;
    const ids = new Set<number>();
    const onDown = (e: PointerEvent) => {
      clearTimer();
      trackpadRef.current?.cancel();
      ids.add(e.pointerId);
      activePointersRef.current = ids.size;
    };
    const onEnd = (e: PointerEvent) => {
      if (!ids.delete(e.pointerId)) return;
      activePointersRef.current = ids.size;
      if (ids.size === 0) {
        queueMicrotask(() => {
          if (ids.size === 0 && resetTimerRef.current === null) resetCard();
        });
      }
    };
    const onBlur = () => {
      ids.clear();
      activePointersRef.current = 0;
      resetCard();
    };
    stageEl.addEventListener('pointerdown', onDown);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
    window.addEventListener('blur', onBlur);
    return () => {
      clearTimer();
      stageEl.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('blur', onBlur);
    };
  }, [stageEl, resetCard]);

  // Attach standalone TrackpadScale for MacBook trackpad pinch-to-zoom
  useEffect(() => {
    if (!stageEl) return;
    const tp = new TrackpadScale(stageEl, {
      onScale: ev => {
        updateCard({scale: ev.scale});
        setStatus(`Trackpad Pinch ${ev.scale.toFixed(2)}×`);
      },
      onScaleEnd: resetCard,
      onScaleCancel: resetCard,
    });
    trackpadRef.current = tp;
    return () => {
      tp.destroy();
      trackpadRef.current = null;
    };
  }, [stageEl, resetCard]);

  return (
    <div
      id="heroStage"
      className="hero-stage"
      ref={bindStage}
      data-flash={flashing ? 'true' : undefined}
    >
      <div
        className={`demo-card${transform.spring ? ' spring-back' : ''}`}
        style={{
          transform: `translate3d(${round(transform.tx)}px, ${round(transform.ty)}px, 0) scale(${round(transform.scale, 3)}) rotate(${round(transform.rot)}deg)`,
        }}
      >
        <strong id="heroDemoStatus">{status}</strong>
        <span className="transform-meta">
          ({Math.round(transform.tx)}, {Math.round(transform.ty)})px · {transform.scale.toFixed(2)}×
          · {transform.rot.toFixed(1)}°
        </span>
        <small>Supports touch, pen, mouse &amp; trackpad pinch</small>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <>
      <header className="container">
        <nav aria-label="Site navigation">
          <h1>Gestures</h1>
          <div className="inline-row">
            <a href="./playground.html">Playground</a>
            <a
              href="https://github.com/jtangelder/gestures"
              target="_blank"
              rel="noopener noreferrer"
              className="secondary"
            >
              GitHub ↗
            </a>
          </div>
        </nav>
      </header>

      <main className="container landing-main">
        <section className="hero-grid" aria-label="Introduction and interactive demo">
          <div className="hero-copy">
            <p className="eyebrow">0.1.0-alpha · ~7–12 kB gzipped · Zero dependencies</p>
            <h2>Modern pointer &amp; multi-touch gestures for the web</h2>
            <p>
              A lightweight gesture recognition engine built around W3C Pointer Events,
              Android-inspired physics &amp; arena arbitration, and tree-shakable descriptors — so
              you only ship the gestures you import.
            </p>
            <div className="inline-row hero-actions">
              <a
                href="https://github.com/jtangelder/gestures"
                target="_blank"
                rel="noopener noreferrer"
                role="button"
              >
                View on GitHub ↗
              </a>
              <a href="./playground.html" role="button" className="secondary outline">
                Open Full Playground →
              </a>
            </div>
          </div>
          <HeroDemo />
        </section>

        <section aria-label="Key capabilities">
          <h2>Built for modern touch &amp; pointer UIs</h2>
          <div className="feature-grid">
            {FEATURES.map(f => (
              <article key={f.title} className="feature-card">
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-label="Code examples">
          <h2>Quick Start</h2>
          <p>
            One tree-shakable descriptor API across Vanilla JS, React, Angular, and standalone
            laptop trackpad pinch.
          </p>
          <CodeExamples />
        </section>

        <section className="info-grid" aria-label="Packages and browser support">
          <article>
            <header>
              <h2>Packages</h2>
            </header>
            <table className="env-table">
              <thead>
                <tr>
                  <th scope="col">Package</th>
                  <th scope="col">Description</th>
                  <th scope="col" className="size-cell">
                    Gzipped
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    <code>@gestures/core</code>
                  </th>
                  <td>Pointer engine, tree-shakable descriptors &amp; recognizers</td>
                  <td className="size-cell">~7.2–12.3 kB</td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>@gestures/react</code>
                  </th>
                  <td>
                    Tree-shakable <code>useGestures</code> React hook
                  </td>
                  <td className="size-cell">~0.3 kB</td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>@gestures/angular</code>
                  </th>
                  <td>
                    Standalone zone-aware <code>[gestures]</code> directive
                  </td>
                  <td className="size-cell">~0.7 kB</td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>@gestures/trackpad</code>
                  </th>
                  <td>
                    Standalone laptop trackpad pinch-to-zoom (<code>ctrl+wheel</code> &amp; Safari{' '}
                    <code>GestureEvent</code>)
                  </td>
                  <td className="size-cell">~1.8 kB</td>
                </tr>
              </tbody>
            </table>
          </article>

          <article>
            <header>
              <h2>Browser Support</h2>
            </header>
            <table className="env-table">
              <tbody>
                <tr>
                  <th scope="row">Chrome</th>
                  <td>60+ (2017 · Desktop &amp; Android)</td>
                </tr>
                <tr>
                  <th scope="row">Edge</th>
                  <td>79+ (2020 · Chromium)</td>
                </tr>
                <tr>
                  <th scope="row">Firefox</th>
                  <td>59+ (2018 · Desktop &amp; Android)</td>
                </tr>
                <tr>
                  <th scope="row">Safari</th>
                  <td>13+ (2019 · macOS, iOS &amp; iPadOS)</td>
                </tr>
              </tbody>
            </table>
          </article>
        </section>
      </main>

      <footer className="container">
        <p>
          MIT License · <a href="./playground.html">Interactive Playground</a> ·{' '}
          <a
            href="https://github.com/jtangelder/gestures"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/jtangelder/gestures
          </a>
        </p>
      </footer>
    </>
  );
}

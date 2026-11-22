import {swipe} from '@gestures/core';
import {useGestures} from '@gestures/react';
import {useEffect, useId, useMemo, useRef, useState, type KeyboardEvent} from 'react';
import {parse, type ParsedToken, type ParseOptions} from 'sugar-high/core';
import * as tsLang from 'sugar-high/lang/typescript';

interface ExampleTab {
  readonly id: string;
  readonly label: string;
  readonly install: string;
  readonly code: string;
}

const EXAMPLES: readonly ExampleTab[] = [
  {
    id: 'vanilla',
    label: 'Vanilla JS',
    install: 'npm install @gestures/core',
    code: `import {Gestures, doubleTap, pan, rotate, scale, tap} from '@gestures/core';

const gestures = new Gestures(element, [
  tap({onTap: ev => console.log('Tap', ev.center)}),
  doubleTap({onTap: ev => console.log('Double tap', ev.center)}),
  pan({
    numPointers: 0,
    onPan: ev => console.log('Pan', ev.deltaX, ev.deltaY),
    onSwipe: ev => console.log('Swipe', ev.direction),
  }),
  scale({onScale: ev => console.log('Scale', ev.scale)}),
  rotate({onRotate: ev => console.log('Rotate', ev.rotation)}),
]);

gestures.destroy();`,
  },
  {
    id: 'react',
    label: 'React',
    install: 'npm install @gestures/core @gestures/react',
    code: `import {doubleTap, pan, tap} from '@gestures/core';
import {useGestures} from '@gestures/react';
import {useState} from 'react';

export function DraggableCard({enabled = true}: {enabled?: boolean}) {
  const [x, setX] = useState(0);

  // Inline callbacks never cancel active drags on re-render
  const ref = useGestures<HTMLDivElement>(
    [
      tap({onTap: ev => console.log('Tap', ev.center)}),
      doubleTap({onTap: () => setX(0)}),
      pan({
        direction: 'horizontal',
        onPan: ev => setX(prev => prev + ev.stepX),
      }),
    ],
    {enabled}
  );

  return (
    <div ref={ref} style={{transform: \`translate3d(\${x}px, 0, 0)\`}}>
      Drag horizontally or double-tap to reset
    </div>
  );
}`,
  },
  {
    id: 'trackpad',
    label: 'Trackpad',
    install: 'npm install @gestures/trackpad',
    code: `import {TrackpadScale} from '@gestures/trackpad';

// Standalone laptop trackpad pinch-to-zoom (ctrl+wheel & macOS Safari GestureEvent)
const trackpad = new TrackpadScale(element, {
  onScaleStart: ev => console.log('Pinch start', ev.center),
  onScale: ev => console.log('Scale', ev.scale, ev.scaleFactor),
  onScaleEnd: ev => console.log('Pinch end', ev.scale),
});

trackpad.destroy();`,
  },
];

function classifyToken(tokens: readonly ParsedToken[], index: number): string {
  const tok = tokens[index];
  if (tok.type === 'class' && /^\d/.test(tok.value)) return 'number';
  if (tok.type === 'identifier' || tok.type === 'property') {
    const next = tokens[index + 1];
    if (next?.type === 'sign' && next.value === '(') return 'fn';
    if (next?.type === 'sign' && next.value === '<' && tokens[index + 2]?.type === 'class') {
      return 'fn';
    }
    if (tok.type === 'identifier' && next?.type === 'sign' && next.value === ':') {
      return 'property';
    }
  }
  return tok.type;
}

function HighlightedCode({code}: {code: string}) {
  const {lines} = useMemo(() => parse(code, tsLang as ParseOptions), [code]);
  return (
    <code>
      {lines.map(line => (
        <span key={line.index} className="sh-line">
          {line.tokens.map((tok, idx) =>
            tok.type === 'space' ? (
              tok.value
            ) : (
              <span key={idx} className={`sh-${classifyToken(line.tokens, idx)}`}>
                {tok.value}
              </span>
            )
          )}
          {line.index < lines.length - 1 ? '\n' : null}
        </span>
      ))}
    </code>
  );
}

const SCROLL_EDGE_EPS = 1;

function getCodeBlock(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('.code-block') : null;
}

function canScrollLeft(el: HTMLElement): boolean {
  return el.scrollLeft > SCROLL_EDGE_EPS;
}

function canScrollRight(el: HTMLElement): boolean {
  return el.scrollLeft + el.clientWidth < el.scrollWidth - SCROLL_EDGE_EPS;
}

function syncCodeTouchAction(el: HTMLElement): void {
  const left = canScrollLeft(el);
  const right = canScrollRight(el);
  const base =
    left && right ? 'pan-x pan-y' : right ? 'pan-right pan-y' : left ? 'pan-left pan-y' : 'pan-y';
  const withPinch = `${base} pinch-zoom`;
  el.style.touchAction =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('touch-action', withPinch)
      ? withPinch
      : base;
}

export function CodeExamples() {
  const baseId = useId();
  const [active, setActive] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const preRefs = useRef<Array<HTMLPreElement | null>>([]);
  const swipePreRef = useRef<HTMLElement | null>(null);

  // Keep each code block's directional `touch-action` synced with its horizontal scroll edges
  // so browsers handle native code scrolling while yielding edge/non-overflowing swipes to JS
  useEffect(() => {
    const syncAll = () => {
      preRefs.current.forEach(pre => {
        if (pre) syncCodeTouchAction(pre);
      });
    };
    syncAll();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncAll) : null;
    preRefs.current.forEach(pre => {
      if (pre) ro?.observe(pre);
    });
    window.addEventListener('resize', syncAll);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', syncAll);
    };
  }, [active]);

  // Sync selection when browser find-in-page matches text inside a `hidden="until-found"` panel
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    panelRefs.current.forEach((panel, index) => {
      if (!panel) return;
      const onBeforeMatch = () => setActive(index);
      panel.addEventListener('beforematch', onBeforeMatch);
      cleanups.push(() => panel.removeEventListener('beforematch', onBeforeMatch));
    });
    return () => cleanups.forEach(fn => fn());
  }, []);

  const selectTab = (index: number, shouldFocus = false) => {
    setActive(index);
    const btn = tabRefs.current[index];
    if (shouldFocus) btn?.focus();
    btn?.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
  };

  // Touch/pen swipe between tabs once an overflowing code block reaches its horizontal scroll edge
  const panelsSwipeRef = useGestures<HTMLDivElement>(
    [
      swipe({
        direction: 'horizontal',
        minSwipeVelocity: 150,
        onSwipe: ev => {
          const pre = swipePreRef.current;
          if (
            ev.direction === 'left' &&
            (!pre || !canScrollRight(pre)) &&
            active < EXAMPLES.length - 1
          ) {
            selectTab(active + 1);
          } else if (ev.direction === 'right' && (!pre || !canScrollLeft(pre)) && active > 0) {
            selectTab(active - 1);
          }
        },
      }),
    ],
    {
      supportedPointerTypes: ['touch', 'pen'],
      touchAction: false,
      ignoreTarget: target => {
        const pre = getCodeBlock(target);
        swipePreRef.current = pre;
        return pre !== null && canScrollLeft(pre) && canScrollRight(pre);
      },
    }
  );

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = EXAMPLES.length;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectTab((index + 1) % count, true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectTab((index - 1 + count) % count, true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectTab(0, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      selectTab(count - 1, true);
    }
  };

  const copyCode = (tab: ExampleTab) => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(tab.code)
        .then(() => {
          setCopiedId(tab.id);
          setTimeout(() => setCopiedId(prev => (prev === tab.id ? null : prev)), 1400);
        })
        .catch(() => {});
    }
  };

  return (
    <div className="code-tabs">
      <div className="tablist" role="tablist" aria-label="Framework code examples">
        {EXAMPLES.map((tab, i) => {
          const isSelected = i === active;
          return (
            <button
              key={tab.id}
              ref={el => {
                tabRefs.current[i] = el;
              }}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectTab(i)}
              onKeyDown={e => onTabKeyDown(e, i)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="tab-panels" ref={panelsSwipeRef}>
        {EXAMPLES.map((tab, i) => {
          const isSelected = i === active;
          return (
            <div
              key={tab.id}
              ref={el => {
                panelRefs.current[i] = el;
              }}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${tab.id}`}
              hidden={isSelected ? undefined : ('until-found' as unknown as boolean)}
            >
              <div className="tab-panel-body">
                <div className="code-header">
                  <code>{tab.install}</code>
                  <button type="button" className="secondary outline" onClick={() => copyCode(tab)}>
                    {copiedId === tab.id ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre
                  ref={el => {
                    preRefs.current[i] = el;
                  }}
                  className="code-block"
                  tabIndex={0}
                  onScroll={e => syncCodeTouchAction(e.currentTarget)}
                >
                  <HighlightedCode code={tab.code} />
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import type {PanDirection, TouchActionSetting} from '@gestures/core';
import type {ReactNode} from 'react';
import {TOUCH_ACTIONS, type Config} from './config';

function Check({
  id,
  checked,
  disabled,
  onChange,
  children,
}: {
  id?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}

export function ConfigPanel({
  config,
  envRows,
  onPatch,
}: {
  config: Config;
  envRows: ReadonlyArray<[string, string]>;
  onPatch: (patch: Partial<Config>, markCustom?: boolean) => void;
}) {
  return (
    <article>
      <header>
        <h2>Configuration</h2>
      </header>

      <details open>
        <summary>Pointers &amp; Touch-Action</summary>
        <fieldset>
          <legend>Supported Pointer Types</legend>
          <div className="inline-row">
            <Check checked={config.pointerTouch} onChange={v => onPatch({pointerTouch: v}, false)}>
              Touch
            </Check>
            <Check checked={config.pointerPen} onChange={v => onPatch({pointerPen: v}, false)}>
              Pen
            </Check>
            <Check checked={config.pointerMouse} onChange={v => onPatch({pointerMouse: v}, false)}>
              Mouse
            </Check>
          </div>
        </fieldset>
        <label htmlFor="touchActionSelect">
          <code>touchAction</code> Policy
          <select
            id="touchActionSelect"
            value={config.touchAction === false ? 'false' : config.touchAction}
            onChange={e =>
              onPatch({
                touchAction:
                  e.target.value === 'false' ? false : (e.target.value as TouchActionSetting),
              })
            }
          >
            <option value="compute">compute (Auto least-restrictive)</option>
            {TOUCH_ACTIONS.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="false">false (Untouched)</option>
          </select>
        </label>
      </details>

      <details open>
        <summary>Gestures</summary>

        <div className="group-box">
          <h3>Tap &amp; Multi-Tap</h3>
          <div className="inline-row">
            <Check
              id="enableSingleTap"
              checked={config.enableSingleTap}
              onChange={v => onPatch({enableSingleTap: v})}
            >
              Single Tap
            </Check>
            <Check
              id="enableDoubleTap"
              checked={config.enableDoubleTap}
              onChange={v => onPatch({enableDoubleTap: v})}
            >
              Double Tap
            </Check>
            <Check
              checked={config.enableTwoFingerTap}
              onChange={v => onPatch({enableTwoFingerTap: v})}
            >
              2-Finger Tap
            </Check>
            <Check
              checked={config.requireDoubleTapFailure}
              disabled={!config.enableSingleTap || !config.enableDoubleTap}
              onChange={v => onPatch({requireDoubleTapFailure: v})}
            >
              <code>requireFailureOf(doubleTap)</code>
            </Check>
          </div>
        </div>

        <div className="group-box">
          <h3>LongPress</h3>
          <div className="inline-row">
            <Check checked={config.enableLongPress} onChange={v => onPatch({enableLongPress: v})}>
              Enable
            </Check>
            <Check
              checked={config.enableLongPressMove}
              onChange={v => onPatch({enableLongPressMove: v})}
            >
              <code>onLongPressMove</code>
            </Check>
          </div>
          <div className="config-grid-2">
            <label>
              Pointers
              <select
                value={config.longPressPointers}
                onChange={e => onPatch({longPressPointers: Number(e.target.value)})}
              >
                <option value={1}>1 pointer</option>
                <option value={2}>2 pointers</option>
              </select>
            </label>
          </div>
        </div>

        <div className="group-box">
          <h3>Pan &amp; Swipe</h3>
          <div className="inline-row">
            <Check checked={config.enablePan} onChange={v => onPatch({enablePan: v})}>
              Pan
            </Check>
            <Check
              checked={config.enableSwipe}
              disabled={!config.enablePan}
              onChange={v => onPatch({enableSwipe: v})}
            >
              Swipe
            </Check>
            <Check
              checked={config.panSimultaneousScaleRotate}
              onChange={v => onPatch({panSimultaneousScaleRotate: v})}
            >
              Simultaneous w/ Scale &amp; Rotate
            </Check>
          </div>
          <div className="config-grid-2">
            <label>
              Direction
              <select
                value={config.panDirection}
                onChange={e => onPatch({panDirection: e.target.value as PanDirection})}
              >
                <option value="both">both</option>
                <option value="horizontal">horizontal</option>
                <option value="vertical">vertical</option>
              </select>
            </label>
            <label>
              <code>numPointers</code>
              <select
                value={config.panPointers}
                onChange={e => onPatch({panPointers: Number(e.target.value)})}
              >
                <option value={1}>1 pointer</option>
                <option value={2}>2 pointers</option>
                <option value={0}>0 (Any)</option>
              </select>
            </label>
          </div>
        </div>

        <div className="group-box">
          <h3>Scale, QuickScale, Trackpad &amp; Rotate</h3>
          <div className="inline-row">
            <Check checked={config.enableScale} onChange={v => onPatch({enableScale: v})}>
              2F Scale
            </Check>
            <Check checked={config.enableRotate} onChange={v => onPatch({enableRotate: v})}>
              2F Rotate
            </Check>
            <Check
              checked={config.scaleRotateSimultaneous}
              onChange={v => onPatch({scaleRotateSimultaneous: v})}
            >
              Scale + Rotate simultaneous
            </Check>
            <Check checked={config.enableQuickScale} onChange={v => onPatch({enableQuickScale: v})}>
              1F QuickScale
            </Check>
            <Check
              checked={config.enableTrackpadScale}
              onChange={v => onPatch({enableTrackpadScale: v})}
            >
              Trackpad Pinch
            </Check>
          </div>
          <div className="config-grid-2">
            <label>
              QuickScale 2× distance (px)
              <input
                type="number"
                min={20}
                max={800}
                step={10}
                value={config.quickScaleSensitivity}
                onChange={e => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 10) onPatch({quickScaleSensitivity: v});
                }}
              />
            </label>
          </div>
        </div>
      </details>

      <details>
        <summary>Device &amp; Browser Capabilities</summary>
        <table className="env-table">
          <tbody>
            {envRows.map(([k, v]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </article>
  );
}

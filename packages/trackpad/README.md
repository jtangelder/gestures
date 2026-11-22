# @gestures/trackpad

Standalone, zero-dependency laptop trackpad pinch-to-zoom recognizer for the web.

Laptop trackpads do not emit multi-touch Pointer Events — browsers instead expose pinch-to-zoom via `ctrl` + `wheel` (Chrome, Edge, Firefox, Safari) and WebKit `GestureEvent` (`gesturestart` / `gesturechange` / `gestureend` on macOS Safari). Keeping this in its own package keeps [`@gestures/core`](../core/README.md) strictly W3C Pointer Events only and keeps non-passive `wheel` listeners strictly opt-in.

## Install

```bash
npm install @gestures/trackpad
```

## Usage

```ts
import {TrackpadScale} from '@gestures/trackpad';

const trackpad = new TrackpadScale(element, {
  onScaleStart: ev => console.log('Start', ev.center),
  onScale: ev => console.log('Scale', ev.scale, ev.scaleFactor),
  onScaleEnd: ev => console.log('End', ev.scale),
});

trackpad.destroy();
```

`TrackpadScale` shares the same callback and event property names (`onScaleStart`, `onScale`, `onScaleEnd`, `onScaleCancel`, `center`, `scale`, `scaleFactor`) as `@gestures/core`'s `scale()` / `quickScale()`, so you can reuse the same zoom handler across touchscreens and laptop trackpads.

## Options

| Option         | Default | Description                                                                                                         |
| :------------- | :------ | :------------------------------------------------------------------------------------------------------------------ |
| `enabled`      | `true`  | Set to `false` to skip attaching listeners.                                                                         |
| `sensitivity`  | `100`   | Wheel `deltaY` magnitude in `px` that doubles (`2x`) or halves (`0.5x`) scale.                                      |
| `endTimeout`   | `150`   | Idle duration in `ms` after the last `ctrl+wheel` event before `onScaleEnd` fires.                                  |
| `ignoreTarget` | `true`  | Ignores `<input>`, `<textarea>`, `<select>`, `<option>`, `[contenteditable]`; accepts `false` or custom predicate.  |
| `propagate`    | `false` | When `false`, an inner `TrackpadScale` claims bubbling events so outer `TrackpadScale` surfaces do not double-zoom. |

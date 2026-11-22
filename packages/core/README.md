# @gestures/core

Modern multi-touch and pointer gesture recognition engine for the web. Zero dependencies, strict TypeScript, tree-shakable ESM.

## Install

```bash
npm install @gestures/core
```

## Usage

### Declarative descriptors (tree-shakable)

```ts
import {Gestures, doubleTap, longPress, pan, quickScale, rotate, scale, tap} from '@gestures/core';

const gestures = new Gestures(element, [
  tap({onTap: ev => console.log('Tap', ev.center, ev.pointerType, ev.target)}),
  doubleTap({onTap: ev => console.log('Double tap', ev.center)}),
  longPress({duration: 500, onLongPress: ev => console.log('Hold', ev.center)}),
  pan({
    numPointers: 0,
    onPan: ev => console.log('Pan', ev.deltaX, ev.deltaY),
    onSwipe: ev => console.log('Swipe', ev.direction),
  }),
  scale({onScale: ev => console.log('Scale', ev.scale)}),
  quickScale({onScale: ev => console.log('QuickScale', ev.scale)}),
  rotate({onRotate: ev => console.log('Rotate', ev.rotation)}),
]);

gestures.destroy();
```

Use `swipe({direction: 'horizontal', onSwipe})` when you only need flick detection without continuous pan tracking.

> **Pointer Events only:** `@gestures/core` recognizes W3C Pointer Events (`touch`, `pen`, `mouse`). For laptop trackpad pinch-to-zoom (`ctrl` + `wheel` / macOS Safari `GestureEvent`), use the standalone [`@gestures/trackpad`](../trackpad/README.md) package.

### Custom recognizers

Subclass `GestureRecognizer` and wrap it with `gesture(...)` to compose seamlessly alongside built-in descriptors:

```ts
import {Gestures, GestureRecognizer, gesture, tap, type MotionEvent} from '@gestures/core';

class InstantPressRecognizer extends GestureRecognizer {
  constructor(private readonly callbacks: {onPress?: () => void}) {
    super();
  }
  protected override onDown(_event: MotionEvent): void {
    this.tryRecognizeDiscrete(() => this.callbacks.onPress?.());
  }
}

const press = gesture(cbs => new InstantPressRecognizer(cbs), {
  onPress: () => console.log('Pressed'),
});

const gestures = new Gestures(element, [
  press,
  tap({onTap: () => console.log('Tap')}).simultaneousWith(press),
]);
```

### Options

Pass an optional third argument `new Gestures(element, gestures, options)`:

| Option                  | Default                     | Description                                                                                                                    |
| :---------------------- | :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| `enabled`               | `true`                      | Set to `false` to disable listeners and surface guards (`touch-action` / `user-select`).                                       |
| `autoWire`              | `true`                      | Automatically wires standard relationships (`tap` waits on `doubleTap`/`quickScale`, `scale` simultaneous with `rotate`).      |
| `touchAction`           | `'compute'`                 | Automatically computes least-restrictive CSS `touch-action`, accepts an explicit value, or `false` to opt out.                 |
| `supportedPointerTypes` | `['touch', 'pen', 'mouse']` | Pointer modalities to observe.                                                                                                 |
| `ignoreTarget`          | `true`                      | Ignores `<input>`, `<textarea>`, `<select>`, `<option>`, `[contenteditable]`; accepts `false` or `(target, event) => boolean`. |
| `propagate`             | `false`                     | When `false`, winning a gesture cancels competing nested `Gestures` surfaces sharing the pointer stream.                       |

## Event Data

Every gesture event extends `GestureEventData`:

- `center` (`{x, y}`) — viewport focal point
- `pointerType` (`'touch' | 'pen' | 'mouse'`) — input modality
- `target` (`EventTarget | null`) — triggering DOM target
- `motionEvent` — normalized multi-pointer `MotionEvent` snapshot
- `originalEvent` — underlying DOM event

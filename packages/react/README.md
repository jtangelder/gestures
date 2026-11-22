# @gestures/react

Tree-shakable React hook for [`@gestures/core`](../core/README.md).

## Install

```bash
npm install @gestures/core @gestures/react
```

## Usage

```tsx
import {doubleTap, pan, tap} from '@gestures/core';
import {useGestures} from '@gestures/react';
import {useState} from 'react';

export function DraggableCard({enabled = true}: {enabled?: boolean}) {
  const [x, setX] = useState(0);

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
    <div ref={ref} style={{transform: `translate3d(${x}px, 0, 0)`}}>
      Drag horizontally or double-tap to reset
    </div>
  );
}
```

- Inline callbacks do **not** require `useCallback` or `useMemo` — updating React state mid-drag never cancels an active gesture.
- Only the gesture factories you import from `@gestures/core` are bundled.

## Trackpad Pinch Hook (`@gestures/react/trackpad`)

If you also install `@gestures/trackpad`, you can use the optional `useTrackpadScale` hook:

```tsx
import {useTrackpadScale} from '@gestures/react/trackpad';

const ref = useTrackpadScale<HTMLDivElement>({
  onScale: ev => console.log('Trackpad scale', ev.scale),
});
```

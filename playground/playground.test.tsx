import {fireEvent, render} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import {App} from './App';

describe('React Playground', () => {
  it('mounts with useGestures + TrackpadScale, switches presets, and handles gestures across re-renders', async () => {
    render(<App />);

    const hitarea = document.getElementById('hitarea')!;
    const presetSelect = document.getElementById('presetSelect') as HTMLSelectElement;
    const childButton = document.getElementById('childButton') as HTMLButtonElement;
    const childClickCount = document.getElementById('childClickCount')!;
    const eventLogCode = document.getElementById('eventLogCode')!;

    expect(hitarea.style.touchAction).toBe('none');

    // Trackpad pinch via @gestures/trackpad
    fireEvent(
      hitarea,
      new WheelEvent('wheel', {bubbles: true, cancelable: true, ctrlKey: true, deltaY: -50})
    );
    expect(eventLogCode.textContent).toContain('TrackpadStart');

    // Switch presets -> touch-action updates declaratively via useGestures
    fireEvent.change(presetSelect, {target: {value: 'carousel'}});
    expect(hitarea.style.touchAction).toBe('pan-y pinch-zoom');

    fireEvent.change(presetSelect, {target: {value: 'feed-card'}});
    expect(hitarea.style.touchAction).toBe('manipulation');

    // Disable doubleTap so singleTap fires immediately on child button click
    const enableDoubleTap = document.getElementById('enableDoubleTap') as HTMLInputElement;
    fireEvent.click(enableDoubleTap);

    const user = userEvent.setup();
    await user.click(childButton);

    expect(childClickCount.textContent).toBe('1');
    expect(eventLogCode.textContent).toContain('SingleTap');
    expect(eventLogCode.textContent).toContain('ChildButtonClick');
  });
});

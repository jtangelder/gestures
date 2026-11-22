import {act, fireEvent, render, screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import {LandingPage} from './LandingPage';
import {PlaygroundApp} from './PlaygroundApp';

function pe(type: string, pointerId: number, clientX: number, clientY: number, isPrimary = true) {
  return Object.assign(new MouseEvent(type, {bubbles: true, cancelable: true, clientX, clientY}), {
    pointerId,
    pointerType: 'touch',
    isPrimary,
    pressure: 0.5,
  });
}

describe('Landing Page', () => {
  it('renders interactive hero demo, switches framework code tabs via click & keyboard, and links to playground', () => {
    render(<LandingPage />);

    // Links to playground and repo
    const playgroundLinks = screen.getAllByRole('link', {name: /playground/i});
    expect(playgroundLinks.some(a => a.getAttribute('href') === './playground.html')).toBe(true);

    // Interactive hero stage responds to trackpad pinch
    const heroStage = document.getElementById('heroStage')!;
    const heroStatus = document.getElementById('heroDemoStatus')!;
    fireEvent(
      heroStage,
      new WheelEvent('wheel', {bubbles: true, cancelable: true, ctrlKey: true, deltaY: -50})
    );
    expect(heroStatus.textContent).toContain('Trackpad Pinch');

    // Accessible framework code tabs (selection follows focus)
    const vanillaTab = screen.getByRole('tab', {name: 'Vanilla JS'});
    const reactTab = screen.getByRole('tab', {name: 'React'});
    const angularTab = screen.getByRole('tab', {name: 'Angular'});

    expect(vanillaTab.getAttribute('aria-selected')).toBe('true');
    expect(document.querySelectorAll('.sh-keyword').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.sh-string').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.sh-fn').length).toBeGreaterThan(0);

    fireEvent.click(reactTab);
    expect(reactTab.getAttribute('aria-selected')).toBe('true');
    expect(vanillaTab.getAttribute('aria-selected')).toBe('false');

    // Keyboard ArrowRight moves focus and selection to Angular tab
    fireEvent.keyDown(reactTab, {key: 'ArrowRight'});
    expect(angularTab.getAttribute('aria-selected')).toBe('true');
  });
});

describe('Interactive Playground', () => {
  it('mounts with useGestures + TrackpadScale, switches presets, and handles gestures across re-renders', async () => {
    render(<PlaygroundApp />);

    const hitarea = document.getElementById('hitarea')!;
    const presetSelect = document.getElementById('presetSelect') as HTMLSelectElement;
    const childButton = document.getElementById('childButton') as HTMLButtonElement;
    const childClickCount = document.getElementById('childClickCount')!;
    const eventLogCode = document.getElementById('eventLogCode')!;

    expect(hitarea.style.touchAction).toBe('none');

    fireEvent(
      hitarea,
      new WheelEvent('wheel', {bubbles: true, cancelable: true, ctrlKey: true, deltaY: -50})
    );
    expect(eventLogCode.textContent).toContain('TrackpadStart');

    fireEvent.change(presetSelect, {target: {value: 'carousel'}});
    expect(hitarea.style.touchAction).toBe('pan-y pinch-zoom');

    fireEvent.change(presetSelect, {target: {value: 'feed-card'}});
    expect(hitarea.style.touchAction).toBe('manipulation');

    const enableDoubleTap = document.getElementById('enableDoubleTap') as HTMLInputElement;
    fireEvent.click(enableDoubleTap);

    const user = userEvent.setup();
    await user.click(childButton);

    expect(childClickCount.textContent).toBe('1');
    expect(eventLogCode.textContent).toContain('SingleTap');
    expect(eventLogCode.textContent).toContain('ChildButtonClick');
  });

  it('resets card transform cleanly after 2-finger rotate/scale when all pointers lift', async () => {
    render(<PlaygroundApp />);

    const hitarea = document.getElementById('hitarea')!;
    const card = document.getElementById('transformCard')!;
    const eventLogCode = document.getElementById('eventLogCode')!;

    fireEvent(hitarea, pe('pointerdown', 1, 100, 100, true));
    fireEvent(hitarea, pe('pointerdown', 2, 200, 100, false));
    fireEvent(document, pe('pointermove', 2, 200, 220, false));
    expect(card.textContent).not.toContain('0.0°');

    fireEvent(document, pe('pointerup', 1, 100, 100, true));
    fireEvent(document, pe('pointerup', 2, 200, 220, false));
    await act(async () => {
      await Promise.resolve();
    });

    expect(eventLogCode.textContent).toContain('RotateEnd');
    expect(card.textContent).toContain('(0, 0)px · 1.00× · 0.0°');
  });
});

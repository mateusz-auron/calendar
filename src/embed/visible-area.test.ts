import { describe, expect, it, vi } from 'vitest';
import {
  DIALOG_MIN_HEIGHT,
  placeDialog,
  VisibleAreaTracker,
  type ObserverFactory,
} from './visible-area';

describe('placeDialog', () => {
  it('fits the dialog inside a large visible slice of a tall iframe', () => {
    // 1500 px iframe, host shows px 600–1400 of it.
    expect(placeDialog({ top: 600, bottom: 1400 }, 1500)).toEqual({
      'dialog-top': 696, // 600 + 12 % of 800
      'dialog-max-height': 752,
      'sheet-bottom': 100,
      'sheet-height': 640,
    });
  });

  it('keeps the minimum height when only a little is visible, and stays inside the iframe', () => {
    const placement = placeDialog({ top: 1400, bottom: 1500 }, 1500);
    expect(placement['dialog-max-height']).toBe(DIALOG_MIN_HEIGHT);
    expect(placement['dialog-top']).toBe(1500 - DIALOG_MIN_HEIGHT - 12);
    expect(placement['sheet-height']).toBe(DIALOG_MIN_HEIGHT);
    expect(placement['sheet-bottom']).toBe(0);
  });

  it('clamps to the top edge when the slice starts at the top', () => {
    const placement = placeDialog({ top: 0, bottom: 200 }, 1500);
    expect(placement['dialog-top']).toBe(24);
    expect(placement['sheet-bottom']).toBe(1500 - DIALOG_MIN_HEIGHT);
  });

  it('copes with a short iframe and a hidden one', () => {
    const short = placeDialog({ top: 0, bottom: 300 }, 300);
    expect(short['dialog-top']).toBe(12);
    expect(short['sheet-bottom']).toBe(0);
    expect(placeDialog({ top: 0, bottom: 0 }, 1500)['dialog-max-height']).toBe(DIALOG_MIN_HEIGHT);
  });
});

describe('VisibleAreaTracker', () => {
  it('publishes the placement as CSS variables when the visible slice changes', () => {
    let callback: IntersectionObserverCallback | undefined;
    const observe = vi.fn();
    const factory: ObserverFactory = (cb) => {
      callback = cb;
      return { observe, disconnect: vi.fn() };
    };
    const tracker = new VisibleAreaTracker(window, factory);
    tracker.start();
    expect(observe).toHaveBeenCalledWith(document.body);

    const entry = {
      isIntersecting: true,
      intersectionRect: { top: 600, bottom: 1400 },
    } as unknown as IntersectionObserverEntry;
    callback?.([entry], {} as IntersectionObserver);

    expect(tracker.current).toEqual({ top: 600, bottom: 1400 });
    const style = document.documentElement.style;
    const expected = placeDialog({ top: 600, bottom: 1400 }, window.innerHeight);
    expect(style.getPropertyValue('--dialog-top')).toBe(`${String(expected['dialog-top'])}px`);
    expect(style.getPropertyValue('--sheet-bottom')).toBe(`${String(expected['sheet-bottom'])}px`);
    tracker.stop();
  });
});

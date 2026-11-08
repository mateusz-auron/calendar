import { describe, expect, it, vi } from 'vitest';
import { IframeHeightReporter, RESIZE_MESSAGE_TYPE } from './iframe-height-reporter';

function fakeWindow(embedded: boolean, height = 500) {
  const parent = { postMessage: vi.fn() };
  const win = {
    document: { body: { getBoundingClientRect: () => ({ height }) } },
  } as unknown as Window & { parent: typeof parent };
  Object.assign(win, { parent: embedded ? parent : win });
  return { win, parent };
}

describe('IframeHeightReporter', () => {
  it('posts height to the parent when embedded, de-duplicating', () => {
    const { win, parent } = fakeWindow(true, 480.2);
    const reporter = new IframeHeightReporter(win, 'https://host.example');
    reporter.report();
    reporter.report();
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: RESIZE_MESSAGE_TYPE, height: 481 },
      'https://host.example',
    );
  });

  it('does nothing when not embedded', () => {
    const { win } = fakeWindow(false);
    const reporter = new IframeHeightReporter(win, '*');
    expect(reporter.isEmbedded).toBe(false);
    expect(() => {
      reporter.report();
    }).not.toThrow();
  });

  it('reports again when fonts finish loading, even if ResizeObserver is paused off-screen', async () => {
    // A ResizeObserver that never fires, like in an off-screen cross-origin iframe.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    let height = 962;
    const parent = { postMessage: vi.fn() };
    const fonts = Object.assign(new EventTarget(), { ready: Promise.resolve() });
    const win = {
      document: { body: { getBoundingClientRect: () => ({ height }) }, fonts },
    } as unknown as Window;
    Object.assign(win, { parent });

    const reporter = new IframeHeightReporter(win, '*');
    reporter.start();
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      { type: RESIZE_MESSAGE_TYPE, height: 962 },
      '*',
    );

    height = 923; // fonts applied: the text re-wraps
    fonts.dispatchEvent(new Event('loadingdone'));
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      { type: RESIZE_MESSAGE_TYPE, height: 923 },
      '*',
    );
    await Promise.resolve();
    vi.unstubAllGlobals();
  });
});

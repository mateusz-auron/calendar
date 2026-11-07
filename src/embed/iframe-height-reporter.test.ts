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
});

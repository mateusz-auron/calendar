import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OVERLAY_CLASS, OverlayModeClient } from './overlay-mode';

const HOST = 'https://host.example';

function setup(targetOrigin = HOST) {
  const parent = { postMessage: vi.fn() };
  let listener: ((event: MessageEvent) => void) | undefined;
  const win = {
    parent,
    document,
    addEventListener: (_: string, fn: (event: MessageEvent) => void) => {
      listener = fn;
    },
    removeEventListener: vi.fn(),
    requestAnimationFrame: (fn: () => void) => setTimeout(fn, 0),
  } as unknown as Window;
  const client = new OverlayModeClient(win, targetOrigin);
  const send = (data: unknown, origin = HOST, source: unknown = parent) => {
    listener?.({ data, origin, source } as unknown as MessageEvent);
  };
  const sent = () => parent.postMessage.mock.calls.map((call) => call[0] as { type: string });
  return { client, send, sent, parent };
}

const rect = { left: 24, top: 300, width: 1152, height: 1200 };
const root = () => document.documentElement;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  root().className = '';
  root().removeAttribute('style');
});

describe('OverlayModeClient', () => {
  it('says hello on start and resolves at once when the host has no overlay support', async () => {
    const { client, sent } = setup();
    client.start();
    expect(sent()).toEqual([{ type: 'calendar:hello' }]);
    await expect(client.enter()).resolves.toBeUndefined();
    expect(sent()).toHaveLength(1); // no calendar:dialog message
  });

  it('switches layout when the host covers the screen, then hands the iframe back', async () => {
    const { client, send, sent, parent } = setup();
    client.start();
    send({ type: 'calendar:host', overlay: true });

    const entered = client.enter();
    expect(sent().at(-1)).toEqual({ type: 'calendar:dialog', open: true });
    send({ type: 'calendar:overlay', active: true, rect });
    await entered;

    expect(client.isActive).toBe(true);
    expect(root().classList.contains(OVERLAY_CLASS)).toBe(true);
    expect(root().style.getPropertyValue('--overlay-top')).toBe('300px');
    expect(root().style.getPropertyValue('--overlay-width')).toBe('1152px');
    await vi.runAllTimersAsync();
    expect(sent().at(-1)).toEqual({ type: 'calendar:overlay-ready' });

    client.exit();
    expect(sent().at(-1)).toEqual({ type: 'calendar:dialog', open: false });
    expect(root().classList.contains(OVERLAY_CLASS)).toBe(true); // until the host answers
    send({ type: 'calendar:overlay', active: false });
    expect(root().classList.contains(OVERLAY_CLASS)).toBe(false);
    await vi.runAllTimersAsync();
    expect(sent().at(-1)).toEqual({ type: 'calendar:overlay-ready' });
    expect(parent.postMessage).toHaveBeenCalledWith(expect.anything(), HOST);
  });

  it('opens the dialog normally when the host does not answer in time', async () => {
    const { client, send } = setup();
    client.start();
    send({ type: 'calendar:host', overlay: true });
    const entered = client.enter();
    await vi.advanceTimersByTimeAsync(600);
    await entered;
    expect(client.isActive).toBe(false);
    expect(root().classList.contains(OVERLAY_CLASS)).toBe(false);
  });

  it('hands the iframe back if the dialog closed before the host switched', () => {
    const { client, send, sent } = setup();
    client.start();
    send({ type: 'calendar:host', overlay: true });
    void client.enter();
    client.exit();
    send({ type: 'calendar:overlay', active: true, rect });
    expect(sent().at(-1)).toEqual({ type: 'calendar:dialog', open: false });
  });

  it('follows rect updates while active (rotation, window resize)', async () => {
    const { client, send } = setup();
    client.start();
    send({ type: 'calendar:host', overlay: true });
    const entered = client.enter();
    send({ type: 'calendar:overlay', active: true, rect });
    await entered;
    send({ type: 'calendar:overlay', active: true, rect: { ...rect, left: 0, width: 390 } });
    expect(root().style.getPropertyValue('--overlay-width')).toBe('390px');
  });

  it('ignores messages from other windows, other origins and malformed rects', () => {
    const { client, send } = setup();
    client.start();
    send({ type: 'calendar:host', overlay: true }, 'https://evil.example');
    send({ type: 'calendar:host', overlay: true }, HOST, {});
    void client.enter(); // not supported yet: resolves at once without asking
    send({ type: 'calendar:host', overlay: true });
    send({ type: 'calendar:overlay', active: true, rect: { left: 'x' } });
    expect(root().classList.contains(OVERLAY_CLASS)).toBe(false);
  });

  it('accepts any parent origin when parentOrigin is "*"', () => {
    const { client, send, sent } = setup('*');
    client.start();
    send({ type: 'calendar:host', overlay: true }, 'https://anywhere.example');
    void client.enter();
    expect(sent().at(-1)).toEqual({ type: 'calendar:dialog', open: true });
  });
});

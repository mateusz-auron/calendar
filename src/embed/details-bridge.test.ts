import { describe, expect, it, vi } from 'vitest';
import { plainDate, yearMonth } from '../domain';
import { DetailsBridge } from './details-bridge';
import { fakeEmbeddedWindow } from './test-window';

const HOST = 'https://host.example';

function setup() {
  const fake = fakeEmbeddedWindow();
  const handlers = { onClosed: vi.fn(), onMonth: vi.fn(), onFallback: vi.fn() };
  const bridge = new DetailsBridge(fake.win, HOST, handlers);
  bridge.start();
  return { ...fake, bridge, handlers };
}

const request = { date: plainDate(2026, 12, 5), eventId: 'dec5', filter: 'all' as const };

describe('DetailsBridge', () => {
  it('says hello and keeps details in the iframe until the host offers a details layer', () => {
    const { bridge, sent, parent } = setup();
    expect(sent()).toEqual([{ type: 'calendar:hello' }]);
    expect(parent.postMessage).toHaveBeenCalledWith({ type: 'calendar:hello' }, HOST);
    expect(bridge.open(request)).toBe(false);
    bridge.monthShown(yearMonth(2026, 11), 'all');
    expect(sent()).toHaveLength(1);
  });

  it('hands requests and months to the host once it offers a details layer', () => {
    const { bridge, receive, sent } = setup();
    receive({ type: 'calendar:host', details: true });
    expect(bridge.open(request)).toBe(true);
    bridge.monthShown(yearMonth(2026, 11), 'pokemon');
    expect(sent().slice(1)).toEqual([
      { type: 'calendar:details', date: '2026-12-05', eventId: 'dec5', filter: 'all' },
      { type: 'calendar:month', month: '2026-11', filter: 'pokemon' },
    ]);
  });

  it('passes closed, month and fallback messages to its handlers', () => {
    const { receive, handlers } = setup();
    receive({ type: 'calendar:details-closed', eventId: 'dec5' });
    receive({ type: 'calendar:month', month: '2026-12' });
    receive({
      type: 'calendar:details-fallback',
      request: { date: '2026-12-05', eventId: 'dec5', filter: 'all' },
    });
    expect(handlers.onClosed).toHaveBeenCalledWith('dec5');
    expect(handlers.onMonth).toHaveBeenCalledWith(yearMonth(2026, 12));
    expect(handlers.onFallback).toHaveBeenCalledWith(request);
  });

  it('ignores other windows, other origins and malformed data', () => {
    const { bridge, receive, handlers } = setup();
    receive({ type: 'calendar:host', details: true }, 'https://evil.example');
    receive({ type: 'calendar:host', details: true }, HOST, {});
    expect(bridge.open(request)).toBe(false);
    receive({ type: 'calendar:month', month: '2026-13' });
    receive({ type: 'calendar:details-fallback', request: { date: 'soon' } });
    receive('calendar:month');
    expect(handlers.onMonth).not.toHaveBeenCalled();
    expect(handlers.onFallback).not.toHaveBeenCalled();
  });
});

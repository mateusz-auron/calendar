import { afterEach, describe, expect, it, vi } from 'vitest';
import { plainDate, yearMonth } from '../domain';
import { DetailsPageClient } from './details-page-client';
import { fakeEmbeddedWindow } from './test-window';

const clients: DetailsPageClient[] = [];

function setup() {
  const fake = fakeEmbeddedWindow();
  const handlers = { onRequest: vi.fn(), onPrefetch: vi.fn(), onShown: vi.fn(), onCancel: vi.fn() };
  const client = new DetailsPageClient(fake.win, 'https://host.example', handlers);
  client.start();
  clients.push(client);
  return { ...fake, client, handlers };
}

afterEach(() => {
  for (const client of clients.splice(0)) client.stop();
  document.body.replaceChildren();
});

describe('DetailsPageClient', () => {
  it('announces itself as the details layer', () => {
    const { sent } = setup();
    expect(sent()).toEqual([{ type: 'calendar:hello', role: 'details' }]);
  });

  it('turns host messages into requests, prefetches and focus', () => {
    const { receive, handlers } = setup();
    receive({ type: 'calendar:details', date: '2026-11-25', filter: 'pokemon' });
    receive({ type: 'calendar:month', month: '2026-12', filter: 'lorcana' });
    receive({ type: 'calendar:details-shown' });
    receive({ type: 'calendar:details-cancel' });
    expect(handlers.onRequest).toHaveBeenCalledWith({
      date: plainDate(2026, 11, 25),
      filter: 'pokemon',
    });
    expect(handlers.onPrefetch).toHaveBeenCalledWith(yearMonth(2026, 12), 'lorcana');
    expect(handlers.onShown).toHaveBeenCalledOnce();
    expect(handlers.onCancel).toHaveBeenCalledOnce();
  });

  it('answers a malformed request with "closed", so the host hides the layer', () => {
    const { receive, handlers, sent } = setup();
    receive({ type: 'calendar:details', date: '2026-02-30' });
    expect(handlers.onRequest).not.toHaveBeenCalled();
    expect(sent().at(-1)).toEqual({ type: 'calendar:details-closed' });
  });

  it('reports ready, closed and month changes to the host', () => {
    const { client, sent } = setup();
    client.ready();
    client.closed('dec5');
    client.navigated(yearMonth(2027, 1));
    expect(sent().slice(1)).toEqual([
      { type: 'calendar:details-ready' },
      { type: 'calendar:details-closed', eventId: 'dec5' },
      { type: 'calendar:month', month: '2027-01' },
    ]);
  });

  it('blocks scrolling outside the dialog only while the layer is shown', () => {
    const { receive, client } = setup();
    const outside = document.createElement('div');
    const scroller = document.createElement('div');
    scroller.className = 'cal-dialog__scroll';
    const inner = document.createElement('p');
    scroller.append(inner);
    document.body.append(outside, scroller);

    const wheel = (target: Element) => {
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(wheel(outside)).toBe(false); // hidden layer: never interferes with the page
    receive({ type: 'calendar:details-shown' });
    expect(wheel(outside)).toBe(true);
    expect(wheel(inner)).toBe(false);
    client.closed(undefined);
    expect(wheel(outside)).toBe(false);
  });
});

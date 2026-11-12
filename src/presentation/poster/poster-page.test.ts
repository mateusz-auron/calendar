import { afterEach, describe, expect, it, vi } from 'vitest';

import { CalendarService } from '../../application';
import {
  overlaps,
  plainDate,
  yearMonth,
  type CalendarEvent,
  type Clock,
  type EventRepository,
  type PlainDate,
} from '../../domain';
import { CalendarFormatter } from '../calendar-formatter';
import { PL } from '../messages';
import type { PosterLayout } from './poster-layout';
import { PosterPage, type PosterSurface } from './poster-page';

const clockAt = (date: PlainDate): Clock => ({
  today: () => date,
  now: () => ({ date, time: { hour: 12, minute: 0 } }),
});

const tournament = (id: string, date: PlainDate): CalendarEvent => ({
  id,
  title: `Turniej ${id}`,
  date,
  startTime: { hour: 18, minute: 0 },
  endTime: { hour: 21, minute: 0 },
  url: 'https://calendar.example/',
  info: { game: { kind: 'known', id: 'pokemon' }, fullFormat: 'Standard' },
});

const EVENTS = [
  tournament('dec4', plainDate(2026, 12, 4)),
  tournament('dec5', plainDate(2026, 12, 5)),
];

class FakeSurface implements PosterSurface {
  readonly element = document.createElement('div');
  readonly drawn: PosterLayout[] = [];
  blob: Blob | undefined = new Blob(['png'], { type: 'image/png' });
  readonly measure = (text: string, font: { size: number }): number =>
    text.length * font.size * 0.55;
  prepare = vi.fn(() => Promise.resolve());
  draw(layout: PosterLayout): Promise<void> {
    this.drawn.push(layout);
    return Promise.resolve();
  }
  toBlob(): Promise<Blob | undefined> {
    return Promise.resolve(this.blob);
  }
}

function setup(
  options: { today?: PlainDate; repository?: EventRepository; initialMonth?: boolean } = {},
) {
  const root = document.createElement('main');
  const surface = new FakeSurface();
  const clock = clockAt(options.today ?? plainDate(2026, 11, 12));
  const repository: EventRepository = options.repository ?? {
    findInRange: (range) => Promise.resolve(EVENTS.filter((e) => overlaps(range, e.date, e.date))),
  };
  const page = new PosterPage({
    root,
    service: new CalendarService(repository, clock, { weekStartsOn: 1 }),
    formatter: new CalendarFormatter('pl-PL'),
    messages: PL,
    clock,
    weekStartsOn: 1,
    surface,
    site: 'booster-ziomki.pl',
    initialMonth: options.initialMonth === false ? undefined : yearMonth(2026, 12),
  });
  const link = () => root.querySelector<HTMLAnchorElement>('.poster-download');
  const button = (selector: string) => {
    const el = root.querySelector<HTMLButtonElement>(selector);
    if (!el) throw new Error(`Missing ${selector}`);
    return el;
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { root, surface, page, link, button, settle };
}

const textsOf = (layout: PosterLayout | undefined): string[] =>
  (layout?.ops ?? []).flatMap((op) => (op.kind === 'text' ? [op.text] : []));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PosterPage', () => {
  it('draws the month as a post and offers it as a PNG download', async () => {
    const { page, surface, link, root } = setup();
    await page.show();

    expect(root.querySelector('.poster-nav__month')?.textContent).toBe('Grudzień 2026');
    expect(surface.drawn).toHaveLength(1);
    expect(surface.drawn[0]?.format).toBe('post');
    expect(textsOf(surface.drawn[0])).toEqual(
      expect.arrayContaining(['Grudzień', '2026', 'booster-ziomki.pl', 'Pokémon', '18:00–21:00']),
    );
    expect(link()?.hidden).toBe(false);
    expect(link()?.getAttribute('download')).toBe('kalendarz-2026-12-post.png');
    expect(link()?.getAttribute('href')).toMatch(/^blob:/);
    expect(root.querySelector('.poster-status')?.textContent).toBe('');
  });

  it('switches to the page-cover format', async () => {
    const { page, surface, button, link, settle } = setup();
    await page.show();
    button('[data-format="cover"]').click();
    await settle();

    expect(surface.drawn.at(-1)?.format).toBe('cover');
    expect(button('[data-format="cover"]').getAttribute('aria-pressed')).toBe('true');
    expect(button('[data-format="post"]').getAttribute('aria-pressed')).toBe('false');
    expect(link()?.getAttribute('download')).toBe('kalendarz-2026-12-cover.png');
  });

  it('moves between months and says when a month has no events', async () => {
    const { page, button, root, link, settle } = setup();
    await page.show();
    button(`[aria-label="${PL.nextMonth}"]`).click();
    await settle();

    expect(page.shownMonth).toEqual(yearMonth(2027, 1));
    expect(root.querySelector('.poster-nav__month')?.textContent).toBe('Styczeń 2027');
    expect(root.querySelector('.poster-status')?.textContent).toBe(PL.eventsInMonth(0));
    expect(link()?.getAttribute('download')).toBe('kalendarz-2027-01-post.png');
  });

  it('opens on the current month, and on the next one late in the month', () => {
    expect(setup({ initialMonth: false, today: plainDate(2026, 11, 20) }).page.shownMonth).toEqual(
      yearMonth(2026, 11),
    );
    expect(setup({ initialMonth: false, today: plainDate(2026, 11, 21) }).page.shownMonth).toEqual(
      yearMonth(2026, 12),
    );
    expect(setup({ initialMonth: false, today: plainDate(2026, 12, 28) }).page.shownMonth).toEqual(
      yearMonth(2027, 1),
    );
  });

  it('never rejects: a failed load shows a retry button that works', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let fail = true;
    const repository: EventRepository = {
      findInRange: () => (fail ? Promise.reject(new Error('offline')) : Promise.resolve(EVENTS)),
    };
    const { page, link, button, root, surface, settle } = setup({ repository });
    await expect(page.show()).resolves.toBeUndefined();
    expect(root.querySelector('.poster-status')?.textContent).toContain(PL.loadError);
    expect(link()?.hidden).toBe(true);
    expect(link()?.hasAttribute('href')).toBe(false);

    fail = false;
    button('.poster-retry').click();
    await settle();
    expect(surface.drawn).toHaveLength(1);
    expect(link()?.hidden).toBe(false);
  });

  it('shows the error state when the browser cannot export the image', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { page, surface, link, root } = setup();
    surface.blob = undefined;
    await page.show();
    expect(root.querySelector('.poster-retry')).not.toBeNull();
    expect(link()?.hidden).toBe(true);
  });

  it('warns when events did not fit in the image', async () => {
    const crowded = Array.from({ length: 3 }, (_, i) =>
      tournament(`x${String(i)}`, plainDate(2026, 12, 4)),
    );
    const { page, button, root, settle } = setup({
      repository: { findInRange: () => Promise.resolve(crowded) },
    });
    await page.show();
    button('[data-format="cover"]').click();
    await settle();
    expect(root.querySelector('.poster-status')?.textContent).toBe(PL.poster.hidden(2));
  });
});

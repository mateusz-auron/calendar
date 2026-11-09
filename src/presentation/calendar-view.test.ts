import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarService } from '../application';
import {
  overlaps,
  plainDate,
  yearMonth,
  type CalendarEvent,
  type Clock,
  type EventLinks,
  type EventRepository,
} from '../domain';
import { CalendarFormatter } from './calendar-formatter';
import { CalendarView, type CalendarViewDeps } from './calendar-view';
import { EN, PL } from './messages';

const NOW = { date: plainDate(2026, 11, 7), time: { hour: 23, minute: 0 } };
const clock: Clock = { today: () => NOW.date, now: () => NOW };

const links: EventLinks = {
  addToCalendarUrl: ({ title }) => `https://cal.example/add?text=${encodeURIComponent(title)}`,
  directionsUrl: (location) => `https://maps.example/?q=${encodeURIComponent(location)}`,
};

const tournament = (
  id: string,
  date: [number, number, number],
  extra: Partial<CalendarEvent> = {},
): CalendarEvent => ({
  id,
  title: `Title ${id}`,
  date: plainDate(...date),
  startTime: { hour: 11, minute: 0 },
  endTime: { hour: 16, minute: 0 },
  url: 'https://calendar.example/',
  location: 'Sklep, ul. Długa 1',
  info: {
    game: { kind: 'known', id: 'pokemon' },
    shortTitle: `Short ${id}`,
    fullFormat: 'Standard · Swiss',
    price: { kind: 'amount', grosze: 2000 },
    registrationUrl: `https://register.example/${id}`,
  },
  ...extra,
});

const EVENTS: CalendarEvent[] = [
  tournament('past', [2026, 11, 2], { info: { game: { kind: 'known', id: 'lorcana' } } }),
  tournament('nov14', [2026, 11, 14]),
  tournament('nov20', [2026, 11, 20]),
  {
    id: 'open-day',
    title: '<b>Dzień otwarty</b>',
    date: plainDate(2026, 11, 18),
    url: 'https://calendar.example/',
    notes: 'Kawa <i>gratis</i>',
  },
  tournament('dec5', [2026, 12, 5]),
];

const repo = (events: readonly CalendarEvent[]): EventRepository => ({
  findInRange: (range) =>
    Promise.resolve(events.filter((e) => overlaps(range, e.date, e.endDate ?? e.date))),
});

function createView(repository: EventRepository = repo(EVENTS), locale = 'pl-PL') {
  const root = document.createElement('div');
  document.body.append(root);
  const view = new CalendarView({
    root,
    service: new CalendarService(repository, clock, { weekStartsOn: 1 }),
    formatter: new CalendarFormatter(locale),
    messages: locale.startsWith('en') ? EN : PL,
    links,
    clock,
    weekStartsOn: 1,
  });
  return { root, view, dialog: view.dialogElement };
}

const tile = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLButtonElement>(`.cal-tile[data-event-id="${id}"]`);

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.className = '';
});

describe('CalendarView – month', () => {
  it('renders the Polish header, count and today', async () => {
    const { root, view } = createView();
    await view.show(view.month);
    expect(root.querySelector('.calendar__title')?.textContent).toBe('Listopad 2026');
    expect(root.querySelector('.cal-bar__count')?.textContent).toBe('4 wydarzenia w tym miesiącu');
    expect(root.querySelector('[aria-current="date"]')?.getAttribute('data-date')).toBe(
      '2026-11-07',
    );
    expect(root.querySelectorAll('tbody tr')).toHaveLength(6);
  });

  it('renders tiles as labelled buttons with short title, time and short format', async () => {
    const { root, view } = createView();
    await view.show(view.month);
    const el = tile(root, 'nov14');
    expect(el?.tagName).toBe('BUTTON');
    expect(el?.querySelector('.cal-tile__title')?.textContent).toBe('Short nov14');
    expect(el?.querySelector('.cal-tile__time')?.textContent).toBe('11:00–16:00');
    expect(el?.querySelector('.cal-tile__format')?.textContent).toBe('Standard');
    expect(el?.getAttribute('aria-label')).toContain('Short nov14');
    expect(el?.getAttribute('aria-label')).toContain('pokaż szczegóły');
    expect(tile(root, 'past')?.classList.contains('is-past')).toBe(true);
  });

  it('renders event data as text (no HTML injection)', async () => {
    const { root, view, dialog } = createView();
    await view.show(view.month);
    expect(root.querySelector('b, i')).toBeNull();
    tile(root, 'open-day')?.click();
    expect(dialog.querySelector('h2')?.textContent).toBe('<b>Dzień otwarty</b>');
    expect(dialog.querySelector('.cal-ev__notes p')?.textContent).toBe('Kawa <i>gratis</i>');
    expect(dialog.querySelector('b, i')).toBeNull();
  });

  it('navigates between months', async () => {
    const { root, view } = createView();
    await view.next();
    expect(view.month).toEqual(yearMonth(2026, 12));
    await view.previous();
    await view.previous();
    expect(root.querySelector('.calendar__title')?.textContent).toBe('Październik 2026');
    await view.today();
    expect(view.month).toEqual(yearMonth(2026, 11));
  });

  it('shows at most two tiles per day and opens the rest from "+N więcej"', async () => {
    const day = [2026, 11, 25] as const;
    const { root, view, dialog } = createView(
      repo([tournament('a', [...day]), tournament('b', [...day]), tournament('c', [...day])]),
    );
    await view.show(view.month);
    const cell = root.querySelector('[data-date="2026-11-25"]');
    expect(cell?.querySelectorAll('.cal-tile')).toHaveLength(2);
    const more = cell?.querySelector<HTMLButtonElement>('.cal-day__more');
    expect(more?.textContent).toBe('+1 więcej');
    more?.click();
    expect(dialog.open).toBe(true);
    expect(dialog.querySelectorAll('article')).toHaveLength(3);
  });

  it('uses English copy for English locales', async () => {
    const { root, view } = createView(repo(EVENTS), 'en-US');
    await view.show(view.month);
    expect(root.querySelector('.calendar__title')?.textContent).toBe('November 2026');
    expect(root.querySelector('.cal-bar__count')?.textContent).toBe('4 events this month');
  });
});

describe('CalendarView – filter', () => {
  it('filters by game, counts every chip and shows "Inne" only when needed', async () => {
    const { root, view } = createView();
    await view.show(view.month);
    const chip = (f: string) => root.querySelector<HTMLButtonElement>(`[data-filter="${f}"]`);
    expect(chip('all')?.getAttribute('aria-pressed')).toBe('true');
    expect(chip('pokemon')?.querySelector('.cal-chip__count')?.textContent).toBe('2');
    expect(chip('other')?.querySelector('.cal-chip__count')?.textContent).toBe('1');

    chip('pokemon')?.click();
    await vi.waitFor(() => {
      expect(chip('pokemon')?.getAttribute('aria-pressed')).toBe('true');
    });
    // nov14, nov20 and dec5 (in the grid's trailing week).
    expect(root.querySelectorAll('.cal-tile')).toHaveLength(3);
    expect(view.activeFilter).toBe('pokemon');

    await view.next(); // the filter survives month changes
    expect(root.querySelectorAll('.cal-tile')).toHaveLength(1);
    expect(chip('other')).toBeNull();
  });

  it('offers "Pokaż wszystkie" when the filtered month is empty', async () => {
    const { root, view } = createView();
    await view.setFilter('riftbound');
    expect(root.querySelector('.cal-empty')?.textContent).toContain(
      'Brak wydarzeń dla wybranej gry',
    );
    root.querySelector<HTMLButtonElement>('.cal-empty__btn')?.click();
    await vi.waitFor(() => {
      expect(view.activeFilter).toBe('all');
    });
  });
});

describe('CalendarView – details dialog', () => {
  it('opens with the full details, links and a registration CTA', async () => {
    const { root, view, dialog } = createView();
    await view.show(view.month);
    tile(root, 'nov14')?.click();

    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('h2')?.textContent).toBe('Title nov14');
    expect(dialog.querySelector('.cal-ev__game')?.textContent).toBe('Pokémon TCG');
    const facts = [...dialog.querySelectorAll('.cal-fact')].map((f) => f.textContent);
    expect(facts).toEqual([
      'TerminSobota, 14 listopada · 11:00–16:00',
      'MiejsceSklep, ul. Długa 1',
      'FormatStandard · Swiss',
      'Liczba miejsc12',
    ]);
    expect(dialog.querySelector('.cal-ev__fee-value')?.textContent).toBe('20\u00a0zł');
    const cta = dialog.querySelector<HTMLAnchorElement>('a.cal-cta');
    expect(cta?.href).toBe('https://register.example/nov14');
    expect(cta?.target).toBe('_blank');
    expect(cta?.rel).toBe('noopener noreferrer');
    const [add, directions] = dialog.querySelectorAll<HTMLAnchorElement>('.cal-ev__link');
    expect(add?.href).toContain('https://cal.example/add?text=Title%20nov14');
    expect(directions?.href).toBe('https://maps.example/?q=Sklep%2C%20ul.%20D%C5%82uga%201');
    expect(dialog.querySelector('.cal-evnav__pos')?.textContent).toBe('2 / 4');
  });

  it('shows defaults and no CTA for a past game event without links', async () => {
    const { root, view, dialog } = createView();
    await view.show(view.month);
    tile(root, 'past')?.click();
    expect(dialog.querySelector('.cal-ev__badge')?.textContent).toBe('Zakończony');
    expect(dialog.querySelector('.cal-ev__fee-value')?.textContent).toBe('TBA');
    expect(dialog.querySelector('.cal-cta')).toBeNull();
    expect(dialog.textContent).not.toContain('Wyniki wkrótce');
    expect(dialog.querySelector('.cal-ev__link')?.textContent).toContain('Wyznacz trasę');
  });

  it('links to the tournament page once an event has ended today without results', async () => {
    // Today 18:00–21:00, and it is already 23:00.
    const ended = tournament('ended-today', [2026, 11, 7], {
      startTime: { hour: 18, minute: 0 },
      endTime: { hour: 21, minute: 0 },
    });
    const { root, view, dialog } = createView(repo([ended]));
    await view.show(view.month);
    tile(root, 'ended-today')?.click();
    expect(dialog.querySelector('.cal-ev__badge')?.textContent).toBe('Zakończony');
    const cta = dialog.querySelector<HTMLAnchorElement>('a.cal-cta');
    expect(cta?.textContent).toContain('Zobacz stronę turnieju');
    expect(cta?.href).toBe('https://register.example/ended-today');
    expect(dialog.textContent).not.toContain('Zapisz się na turniej');
  });

  it('hides the location and directions link when neither the event nor a default has one', async () => {
    const { location, ...withoutLocation } = tournament('no-location', [2026, 11, 14]);
    expect(location).toBeTruthy();
    const { root, view, dialog } = createView(repo([withoutLocation]));
    await view.show(view.month);
    tile(root, 'no-location')?.click();
    const labels = [...dialog.querySelectorAll('.cal-fact dt')].map((dt) => dt.textContent);
    expect(labels).not.toContain('Miejsce');
    expect([...dialog.querySelectorAll('.cal-ev__link')].map((a) => a.textContent)).toEqual([
      'Dodaj do kalendarza (otwiera się w nowej karcie)',
    ]);
  });

  it('shows a generic event with only title, date and notes', async () => {
    const { root, view, dialog } = createView();
    await view.show(view.month);
    tile(root, 'open-day')?.click();
    expect(dialog.querySelector('.cal-ev__game')).toBeNull();
    expect(dialog.querySelectorAll('.cal-fact')).toHaveLength(1);
    expect(dialog.querySelector('.cal-fact')?.textContent).toBe(
      'TerminŚroda, 18 listopada · Cały dzień',
    );
    expect(dialog.querySelector('.cal-ev__foot')).toBeNull();
    expect(dialog.querySelector('.generic-logo')).not.toBeNull();
  });

  it('closes with the close button and returns focus to the tile', async () => {
    const { root, view, dialog } = createView();
    await view.show(view.month);
    const trigger = tile(root, 'nov14');
    trigger?.focus();
    trigger?.click();
    dialog.querySelector<HTMLButtonElement>('.cal-dialog__close')?.click();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('navigates to the next event across a month boundary and keeps the dialog open', async () => {
    const { root, view, dialog } = createView();
    await view.show(view.month);
    tile(root, 'nov20')?.click();
    const next = dialog.querySelector<HTMLButtonElement>('.cal-evnav__btn:last-child');
    await vi.waitFor(() => {
      expect(next?.disabled).toBe(false);
    });
    expect(next?.getAttribute('aria-label')).toContain('Następne wydarzenie: Short dec5');

    await view.navigateEvent(1);
    expect(view.month).toEqual(yearMonth(2026, 12));
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('h2')?.textContent).toBe('Title dec5');

    // Closing after the month changed: the old tile is gone, focus goes to the title.
    dialog.close();
    expect(document.activeElement).toBe(root.querySelector('.calendar__title'));
  });

  it("counts an event from a neighbouring month's row within its own month", async () => {
    // January 2027 starts on a Friday: its first row shows 28–31 December.
    const { root, view, dialog } = createView(
      repo([
        tournament('dec10', [2026, 12, 10]),
        tournament('dec29', [2026, 12, 29]),
        tournament('dec30', [2026, 12, 30]),
        tournament('jan8', [2027, 1, 8]),
      ]),
    );
    await view.show(yearMonth(2027, 1));
    tile(root, 'dec29')?.click();
    const position = () => dialog.querySelector('.cal-evnav__pos')?.textContent;
    await vi.waitFor(() => {
      expect(position()).toBe('2 / 3');
    });
  });

  it('jumps from the last event of a month to 1 / N of the next one, and back', async () => {
    const { root, view, dialog } = createView(
      repo([
        tournament('nov14', [2026, 11, 14]),
        tournament('nov20', [2026, 11, 20]),
        tournament('dec10', [2026, 12, 10]),
        tournament('dec12', [2026, 12, 12]),
      ]),
    );
    await view.show(view.month);
    const position = () => dialog.querySelector('.cal-evnav__pos')?.textContent;
    tile(root, 'nov20')?.click();
    expect(position()).toBe('2 / 2');

    await view.navigateEvent(1);
    expect(view.month).toEqual(yearMonth(2026, 12));
    expect(dialog.querySelector('h2')?.textContent).toBe('Title dec10');
    expect(position()).toBe('1 / 2');

    await view.navigateEvent(-1);
    expect(view.month).toEqual(yearMonth(2026, 11));
    expect(dialog.querySelector('h2')?.textContent).toBe('Title nov20');
    expect(position()).toBe('2 / 2');
  });

  it('drags the phone sheet down to close it, without letting the drag scroll the page', async () => {
    // Narrow screen: the dialog is a bottom sheet that can be dragged.
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    const { root, view, dialog } = createView();
    await view.show(view.month);
    tile(root, 'nov14')?.click();
    const banner = dialog.querySelector('.cal-ev__banner');
    const touch = (type: string, clientY?: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', {
        value: clientY === undefined ? [] : [{ clientY }],
      });
      banner?.dispatchEvent(event);
      return event;
    };

    touch('touchstart', 100);
    // A scroll started by the drag would keep coasting after the sheet closes, and the next
    // tap on the calendar would only stop it instead of opening an event.
    expect(touch('touchmove', 150).defaultPrevented).toBe(true);
    touch('touchmove', 260);
    touch('touchend');
    expect(dialog.open).toBe(false);
    vi.restoreAllMocks();
  });

  it('closes when the month is changed from the header', async () => {
    const { root, view, dialog } = createView();
    await view.show(view.month);
    tile(root, 'nov14')?.click();
    await view.next();
    expect(dialog.open).toBe(false);
  });
});

describe('CalendarView – details layer (embed.js)', () => {
  function createWith(extra: Partial<CalendarViewDeps>) {
    const root = document.createElement('div');
    document.body.append(root);
    const view = new CalendarView({
      root,
      service: new CalendarService(repo(EVENTS), clock, { weekStartsOn: 1 }),
      formatter: new CalendarFormatter('pl-PL'),
      messages: PL,
      links,
      clock,
      weekStartsOn: 1,
      ...extra,
    });
    return { root, view, dialog: view.dialogElement };
  }

  it('hands event and day clicks to the details layer and restores focus afterwards', async () => {
    const delegate = vi.fn(() => true);
    const { root, view, dialog } = createWith({ detailsDelegate: delegate });
    await view.show(view.month);
    const trigger = tile(root, 'nov14');
    trigger?.click();
    expect(delegate).toHaveBeenCalledWith({
      date: plainDate(2026, 11, 14),
      eventId: 'nov14',
      filter: 'all',
    });
    expect(dialog.open).toBe(false);

    view.restoreFocus('nov14');
    expect(document.activeElement).toBe(trigger);
  });

  it('opens the details itself when the delegate declines', async () => {
    const { root, view, dialog } = createWith({ detailsDelegate: () => false });
    await view.show(view.month);
    tile(root, 'nov14')?.click();
    expect(dialog.open).toBe(true);
  });

  it('opens a requested event, also from another month, and reports shown/closed', async () => {
    const onDetailsShown = vi.fn();
    const onDetailsClosed = vi.fn();
    const { view, dialog } = createWith({ onDetailsShown, onDetailsClosed });
    await view.show(view.month);

    expect(
      await view.openRequest({ date: plainDate(2026, 12, 5), eventId: 'dec5', filter: 'all' }),
    ).toBe(true);
    expect(view.month).toEqual(yearMonth(2026, 11)); // 5 Dec is in November's last row
    expect(dialog.querySelector('h2')?.textContent).toBe('Title dec5');
    expect(dialog.querySelector('.cal-evnav__pos')?.textContent).toBe('');
    await vi.waitFor(() => {
      expect(dialog.querySelector('.cal-evnav__pos')?.textContent).toBe('1 / 1');
    });
    expect(onDetailsShown).toHaveBeenCalledOnce();

    dialog.close();
    expect(onDetailsClosed).toHaveBeenCalledWith('dec5');
  });

  it('opens a day request as a list and rejects unknown events', async () => {
    const day = [2026, 11, 25] as const;
    const { view, dialog } = createWith({});
    await view.show(view.month);
    expect(
      await view.openRequest({ date: plainDate(2026, 11, 3), eventId: 'x', filter: 'all' }),
    ).toBe(false);
    expect(dialog.open).toBe(false);

    const repoDay = repo([tournament('a', [...day]), tournament('b', [...day])]);
    const other = new CalendarView({
      root: document.createElement('div'),
      service: new CalendarService(repoDay, clock, { weekStartsOn: 1 }),
      formatter: new CalendarFormatter('pl-PL'),
      messages: PL,
      links,
      clock,
      weekStartsOn: 1,
    });
    expect(await other.openRequest({ date: plainDate(...day), filter: 'all' })).toBe(true);
    expect(other.dialogElement.querySelectorAll('article')).toHaveLength(2);
  });

  it('applies the requested filter and reports month changes from prev/next', async () => {
    const onEventNavigated = vi.fn();
    const { view, dialog } = createWith({ onEventNavigated });
    await view.openRequest({ date: plainDate(2026, 11, 20), eventId: 'nov20', filter: 'pokemon' });
    expect(view.activeFilter).toBe('pokemon');
    await view.navigateEvent(1);
    expect(dialog.querySelector('h2')?.textContent).toBe('Title dec5');
    expect(onEventNavigated).toHaveBeenCalledWith(yearMonth(2026, 12));
  });

  it('ignores prefetching while the details are open', async () => {
    const { view } = createWith({});
    await view.openRequest({ date: plainDate(2026, 11, 14), eventId: 'nov14', filter: 'all' });
    await view.prefetch(yearMonth(2027, 3), 'all');
    expect(view.month).toEqual(yearMonth(2026, 11));
  });
});

describe('CalendarView – errors', () => {
  it('renders an error with a working retry instead of failing silently', async () => {
    const findInRange = vi
      .fn<EventRepository['findInRange']>()
      .mockRejectedValueOnce(new Error('Calendar not found or not public.'))
      .mockResolvedValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { root, view } = createView({ findInRange });

    await view.show(view.month);
    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Nie udało się wczytać wydarzeń.');
    expect(alert?.textContent).toContain('Calendar not found or not public.');
    expect(root.getAttribute('aria-busy')).toBeNull();

    root.querySelector<HTMLButtonElement>('.calendar__retry')?.click();
    await vi.waitFor(() => {
      expect(root.querySelector('.calendar__grid')).not.toBeNull();
    });
    expect(findInRange).toHaveBeenCalledTimes(2);
  });
});

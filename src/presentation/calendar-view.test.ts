import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarService } from '../application';
import {
  plainDate,
  yearMonth,
  type CalendarEvent,
  type Clock,
  type DateRange,
  type EventRepository,
} from '../domain';
import { CalendarFormatter } from './calendar-formatter';
import { CalendarView } from './calendar-view';

const clock: Clock = { today: () => plainDate(2026, 11, 7) };

/** One event on the 10th of the grid's middle month. */
const monthlyRepository: EventRepository = {
  findInRange: (range: DateRange) => {
    const m = range.end.month === 1 ? 12 : range.end.month - 1;
    const y = range.end.month === 1 ? range.end.year - 1 : range.end.year;
    return Promise.resolve([
      {
        id: `e-${String(m)}`,
        title: `<b>Event ${String(m)}</b>`,
        date: plainDate(y, m, 10),
        url: 'https://www.google.com/',
      },
    ]);
  },
};

function createView(repository: EventRepository) {
  const root = document.createElement('div');
  const view = new CalendarView({
    root,
    service: new CalendarService(repository, clock, { weekStartsOn: 1 }),
    formatter: new CalendarFormatter('en-US'),
    clock,
    weekStartsOn: 1,
  });
  return { root, view };
}

describe('CalendarView', () => {
  let root: HTMLElement;
  let view: CalendarView;

  beforeEach(() => {
    ({ root, view } = createView(monthlyRepository));
  });

  it('renders the current month with clickable events opening in a new tab', async () => {
    await view.show(view.month);
    expect(root.querySelector('.calendar__title')?.textContent).toBe('November 2026');
    const link = root.querySelector<HTMLAnchorElement>('[data-event-id="e-11"]');
    expect(link?.getAttribute('href')).toBe('https://www.google.com/');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toBe('noopener noreferrer');
    expect(root.querySelector('[aria-current="date"]')?.getAttribute('data-date')).toBe(
      '2026-11-07',
    );
  });

  it('renders event titles as text (no HTML injection)', async () => {
    await view.show(view.month);
    expect(root.querySelector('.calendar__event b')).toBeNull();
    expect(root.querySelector('[data-event-id="e-11"]')?.textContent).toBe('<b>Event 11</b>');
  });

  it('navigates between months', async () => {
    await view.next();
    expect(view.month).toEqual(yearMonth(2026, 12));
    await view.previous();
    await view.previous();
    expect(root.querySelector('.calendar__title')?.textContent).toBe('October 2026');
    await view.today();
    expect(view.month).toEqual(yearMonth(2026, 11));
  });

  it('shows start time for timed events and spans multi-day events', async () => {
    const events: CalendarEvent[] = [
      {
        id: 'standup',
        title: 'Standup',
        date: plainDate(2026, 11, 12),
        startTime: { hour: 9, minute: 30 },
        url: 'https://x/',
      },
      {
        id: 'trip',
        title: 'Trip',
        date: plainDate(2026, 11, 20),
        endDate: plainDate(2026, 11, 22),
        url: 'https://x/',
      },
    ];
    ({ root, view } = createView({ findInRange: () => Promise.resolve(events) }));
    await view.show(view.month);

    expect(root.querySelector('[data-event-id="standup"] .calendar__event-time')?.textContent).toBe(
      '9:30 AM',
    );
    expect(root.querySelectorAll('[data-event-id="trip"]')).toHaveLength(3);
  });

  it('renders an error with a working retry instead of failing silently', async () => {
    const findInRange = vi
      .fn<EventRepository['findInRange']>()
      .mockRejectedValueOnce(new Error('Calendar not found or not public.'))
      .mockResolvedValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    ({ root, view } = createView({ findInRange }));

    await view.show(view.month);
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Calendar not found or not public.',
    );
    expect(root.getAttribute('aria-busy')).toBeNull();

    root.querySelector<HTMLButtonElement>('.calendar__retry')?.click();
    await vi.waitFor(() => {
      expect(root.querySelector('.calendar__grid')).not.toBeNull();
    });
    expect(findInRange).toHaveBeenCalledTimes(2);
  });
});

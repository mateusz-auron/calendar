import { beforeEach, describe, expect, it } from 'vitest';
import { CalendarService } from '../application';
import { plainDate, yearMonth, type Clock, type EventRepository } from '../domain';
import { CalendarFormatter } from './calendar-formatter';
import { CalendarView } from './calendar-view';

const clock: Clock = { today: () => plainDate(2026, 11, 7) };
const repository: EventRepository = {
  findByMonth: (m) =>
    Promise.resolve([
      {
        id: `e-${String(m.month)}`,
        title: `<b>Event ${String(m.month)}</b>`,
        date: plainDate(m.year, m.month, 10),
        url: 'https://www.google.com/',
      },
    ]),
};

describe('CalendarView', () => {
  let root: HTMLElement;
  let view: CalendarView;

  beforeEach(() => {
    root = document.createElement('div');
    view = new CalendarView({
      root,
      service: new CalendarService(repository, clock, { weekStartsOn: 1 }),
      formatter: new CalendarFormatter('en-US'),
      clock,
      weekStartsOn: 1,
    });
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
});

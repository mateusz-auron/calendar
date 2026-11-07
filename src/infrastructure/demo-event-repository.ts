import {
  addMonths,
  contains,
  daysInMonth,
  isSameYearMonth,
  plainDate,
  toYearMonthString,
  yearMonthOf,
  type CalendarEvent,
  type DateRange,
  type EventRepository,
  type YearMonth,
} from '../domain';
import { seededRandom } from './seeded-random';

export interface DemoEventRepositoryOptions {
  /** Target of every generated event. */
  readonly eventUrl: string;
  /** Changes the generated days; same seed ⇒ same calendar. */
  readonly seed?: number;
}

const TITLES = [
  'New Year Kick-off',
  'Winter Workshop',
  'Spring Meetup',
  'Product Demo',
  'Community Day',
  'Summer Hackathon',
  'Team Offsite',
  'Tech Talk',
  'Autumn Conference',
  'Open House',
  'Planning Session',
  'Year-end Party',
] as const;

/**
 * PoC adapter: one event per month on a pseudo-random (but deterministic) day.
 * Used when no Google Calendar is configured.
 */
export class DemoEventRepository implements EventRepository {
  private readonly seed: number;

  constructor(private readonly options: DemoEventRepositoryOptions) {
    this.seed = options.seed ?? 2026;
  }

  findInRange(range: DateRange): Promise<readonly CalendarEvent[]> {
    const events: CalendarEvent[] = [];
    const last = yearMonthOf(range.end);
    for (let m = yearMonthOf(range.start); ; m = addMonths(m, 1)) {
      const event = this.eventFor(m);
      if (contains(range, event.date)) events.push(event);
      if (isSameYearMonth(m, last)) break;
    }
    return Promise.resolve(events);
  }

  private eventFor(month: YearMonth): CalendarEvent {
    const random = seededRandom(this.seed * 100_003 + month.year * 12 + month.month);
    const day = 1 + Math.floor(random() * daysInMonth(month));
    const title = TITLES[month.month - 1] ?? 'Event';
    return {
      id: `demo-${toYearMonthString(month)}`,
      title,
      date: plainDate(month.year, month.month, day),
      url: this.options.eventUrl,
      description: `${title} — demo event`,
    };
  }
}

import {
  daysInMonth,
  plainDate,
  toYearMonthString,
  type CalendarEvent,
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
 * Swap for an HTTP/JSON-backed `EventRepository` without touching other layers.
 */
export class DemoEventRepository implements EventRepository {
  private readonly seed: number;

  constructor(private readonly options: DemoEventRepositoryOptions) {
    this.seed = options.seed ?? 2026;
  }

  findByMonth(month: YearMonth): Promise<readonly CalendarEvent[]> {
    const random = seededRandom(this.seed * 100_003 + month.year * 12 + month.month);
    const day = 1 + Math.floor(random() * daysInMonth(month));
    const title = TITLES[month.month - 1] ?? 'Event';

    return Promise.resolve([
      {
        id: `demo-${toYearMonthString(month)}`,
        title,
        date: plainDate(month.year, month.month, day),
        url: this.options.eventUrl,
        description: `${title} — demo event`,
      },
    ]);
  }
}

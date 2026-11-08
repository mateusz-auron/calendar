import {
  addDays,
  addMonths,
  compareDates,
  contains,
  daysInMonth,
  isSameYearMonth,
  plainDate,
  toIsoString,
  toYearMonthString,
  weekdayOf,
  yearMonthOf,
  type CalendarEvent,
  type DateRange,
  type EventRepository,
  type GameId,
  type PlainDate,
  type TimeOfDay,
  type Weekday,
  type YearMonth,
} from '../domain';
import { parseEventDescription } from './event-description-parser';
import { seededRandom } from './seeded-random';

export interface DemoEventRepositoryOptions {
  /** Registration/results link of every generated tournament. */
  readonly eventUrl: string;
  /** Changes the generated details; same seed ⇒ same calendar. */
  readonly seed?: number;
}

const LOCATION = 'Sklep z grami, ul. Przykładowa 1, Kraków';

interface Variant {
  readonly title: string;
  /** Description lines in the organiser format (docs/event-description.md). */
  readonly fields: readonly string[];
}

interface WeeklySlot {
  readonly game: GameId;
  readonly gameLine: string;
  readonly start: TimeOfDay;
  readonly end: TimeOfDay;
  readonly variants: readonly Variant[];
}

const t = (hour: number, minute = 0): TimeOfDay => ({ hour, minute });

/** The design's weekly rhythm: Mon Lorcana, Tue Riftbound, Fri One Piece, Sat Pokémon. */
const WEEKLY: Partial<Record<Weekday, WeeklySlot>> = {
  1: {
    game: 'lorcana',
    gameLine: 'gra: Disney Lorcana',
    start: t(18),
    end: t(21),
    variants: [
      {
        title: 'Disney Lorcana — Liga tygodniowa',
        fields: ['krótki tytuł: Liga', 'format: Core Constructed · 3 rundy', 'wpisowe: 15'],
      },
      {
        title: 'Disney Lorcana — wieczór Sealed',
        fields: ['krótki tytuł: Sealed', 'format: Sealed · 3 rundy', 'wpisowe: 90 zł'],
      },
    ],
  },
  2: {
    game: 'riftbound',
    gameLine: 'game: Riftbound',
    start: t(17, 30),
    end: t(21),
    variants: [
      {
        title: 'Riftbound — wieczór otwartej gry i nauki',
        fields: ['short_title: Nauka gry', 'full_format: Open play · nauka gry', 'price: 0'],
      },
      {
        title: 'Riftbound Store Showdown',
        fields: ['short_title: Showdown', 'full_format: Constructed · Swiss + Top 4', 'price: 35'],
      },
    ],
  },
  5: {
    game: 'onepiece',
    gameLine: 'game: One Piece',
    start: t(18),
    end: t(21, 30),
    variants: [
      {
        title: 'One Piece Card Game — cotygodniowy turniej',
        fields: ['short_title: Turniej', 'full_format: Standard · 3 rundy', 'price: 15'],
      },
      {
        title: 'One Piece Card Game Treasure Cup',
        fields: ['short_title: Treasure Cup', 'full_format: Standard · Swiss + Top 8', 'price: 50'],
      },
    ],
  },
  6: {
    game: 'pokemon',
    gameLine: 'game: Pokémon',
    start: t(11),
    end: t(16),
    variants: [
      {
        title: 'Pokémon TCG League Challenge',
        fields: ['short_title: League Challenge', 'full_format: Standard · Swiss', 'price: 20'],
      },
      {
        title: 'Pokémon TCG Prerelease',
        fields: ['short_title: Prerelease', 'full_format: Sealed · 3 rundy', 'price: 120 zł'],
      },
    ],
  },
};

/**
 * PoC adapter used when no Google Calendar is configured: a weekly rhythm of
 * tournaments, plus per month one generic event and one tournament with every
 * optional field missing, so the demo shows all defaults. Deterministic per seed.
 */
export class DemoEventRepository implements EventRepository {
  private readonly seed: number;

  constructor(private readonly options: DemoEventRepositoryOptions) {
    this.seed = options.seed ?? 2026;
  }

  findInRange(range: DateRange): Promise<readonly CalendarEvent[]> {
    const events: CalendarEvent[] = [];
    for (let day = range.start; compareDates(day, range.end) <= 0; day = addDays(day, 1)) {
      const slot = WEEKLY[weekdayOf(day)];
      if (slot) events.push(this.tournament(day, slot));
    }
    const last = yearMonthOf(range.end);
    for (let m = yearMonthOf(range.start); ; m = addMonths(m, 1)) {
      for (const event of this.monthlyExtras(m)) {
        if (contains(range, event.date)) events.push(event);
      }
      if (isSameYearMonth(m, last)) break;
    }
    return Promise.resolve(events);
  }

  private random(key: string): () => number {
    let hash = this.seed;
    for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return seededRandom(hash);
  }

  private tournament(day: PlainDate, slot: WeeklySlot): CalendarEvent {
    const random = this.random(toIsoString(day));
    const variant = slot.variants[Math.floor(random() * slot.variants.length)] ?? slot.variants[0];
    const seats = 8 + Math.floor(random() * 5) * 4;
    const withResults = random() < 0.6;
    const description = [
      slot.gameLine,
      ...(variant?.fields ?? []),
      `miejsca: ${String(seats)}`,
      `zapisy: ${this.options.eventUrl}`,
      `wyniki: ${withResults ? this.options.eventUrl : ''}`,
    ].join('\n');
    return this.event(`demo-${toIsoString(day)}-${slot.game}`, variant?.title ?? '', day, {
      description,
      start: slot.start,
      end: slot.end,
    });
  }

  /** A generic event and a bare tournament on free weekdays (Wed, Thu, Sun). */
  private monthlyExtras(month: YearMonth): CalendarEvent[] {
    const freeDays = Array.from({ length: daysInMonth(month) }, (_, i) =>
      plainDate(month.year, month.month, i + 1),
    ).filter((d) => [0, 3, 4].includes(weekdayOf(d)));
    const random = this.random(toYearMonthString(month));
    const pick = () => freeDays.splice(Math.floor(random() * freeDays.length), 1)[0];
    const genericDay = pick();
    const bareDay = pick();
    const ym = toYearMonthString(month);
    return [
      genericDay &&
        this.event(`demo-${ym}-open-day`, 'Dzień otwarty sklepu', genericDay, {
          description: 'Wpadnij poznać nasze gry. Kawa i herbata gratis.',
          start: t(16),
          end: t(20),
        }),
      bareDay &&
        this.event(`demo-${ym}-tba`, 'Turniej Pokémon — szczegóły wkrótce', bareDay, {
          description: 'game: Pokemon',
          start: t(12),
          end: t(17),
        }),
    ].filter((e) => e !== undefined);
  }

  private event(
    id: string,
    title: string,
    date: PlainDate,
    details: { description: string; start: TimeOfDay; end: TimeOfDay },
  ): CalendarEvent {
    const { info, notes } = parseEventDescription(details.description);
    return {
      id,
      title,
      date,
      startTime: details.start,
      endTime: details.end,
      url: this.options.eventUrl,
      location: LOCATION,
      ...(Object.keys(info).length > 0 ? { info } : {}),
      ...(notes ? { notes } : {}),
    };
  }
}

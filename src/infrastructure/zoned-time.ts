import { plainDate, type PlainDate, type TimeOfDay } from '../domain';

export interface ZonedParts {
  readonly date: PlainDate;
  readonly time: TimeOfDay;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Wall-clock date and time of an instant in an IANA time zone. */
export function toZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const p of formatterFor(timeZone).formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return {
    date: plainDate(parts.year ?? 0, parts.month ?? 0, parts.day ?? 0),
    time: { hour: (parts.hour ?? 0) % 24, minute: parts.minute ?? 0 },
  };
}

/** The instant (epoch ms) at which the wall clock in `timeZone` shows `date` `time`. */
export function zonedToEpochMs(date: PlainDate, time: TimeOfDay, timeZone: string): number {
  const wall = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute);
  let instant = wall;
  // Two rounds settle the zone offset, also next to a DST change.
  for (let round = 0; round < 2; round++) {
    const seen = toZonedParts(new Date(instant), timeZone);
    instant +=
      wall -
      Date.UTC(
        seen.date.year,
        seen.date.month - 1,
        seen.date.day,
        seen.time.hour,
        seen.time.minute,
      );
  }
  return instant;
}

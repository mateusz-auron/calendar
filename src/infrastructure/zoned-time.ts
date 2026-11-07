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

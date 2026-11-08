import {
  addDays,
  compareDates,
  plainDate,
  type CalendarEvent,
  type PlainDate,
  type TimeOfDay,
} from '../domain';
import { parseEventDescription } from './event-description-parser';
import { toZonedParts } from './zoned-time';

/**
 * Source-neutral event shape shared by the Google Calendar API and the iCal
 * snapshot. Mirrors Google's `start`/`end` objects: either an all-day `date`
 * (`YYYY-MM-DD`) or an instant `dateTime` (RFC 3339). `end` is exclusive.
 */
export interface RawEventTime {
  readonly date?: string;
  readonly dateTime?: string;
}

export interface RawEvent {
  readonly id: string;
  readonly status?: string;
  readonly title?: string;
  readonly description?: string;
  readonly location?: string;
  readonly url?: string;
  readonly start?: RawEventTime;
  readonly end?: RawEventTime;
}

export interface RawEventMappingOptions {
  /** IANA zone used to place timed events on days. */
  readonly timeZone: string;
  /** Used when the event has no (safe) link of its own. */
  readonly fallbackUrl: string;
}

/**
 * A timed event that ends before this hour on the day after it starts (a
 * tournament running until 01:00) stays on its first day in the grid.
 */
const OVERNIGHT_END_HOUR = 6;
const MAX_LOCATION_LENGTH = 200;

/** Maps a raw event to the domain model; `undefined` for cancelled or malformed events. */
export function toCalendarEvent(
  raw: RawEvent,
  options: RawEventMappingOptions,
): CalendarEvent | undefined {
  if (raw.status?.toLowerCase() === 'cancelled' || !raw.start) return undefined;
  const start = resolveStart(raw.start, options.timeZone);
  if (!start) return undefined;
  const end = raw.end ? resolveEnd(raw.end, start, options.timeZone) : undefined;

  const { info, notes } = parseEventDescription(raw.description);
  const location = raw.location?.replace(/\s+/g, ' ').trim().slice(0, MAX_LOCATION_LENGTH);
  return {
    id: raw.id,
    title: raw.title?.trim() ?? '',
    date: start.date,
    ...(end?.lastDay && compareDates(end.lastDay, start.date) > 0 ? { endDate: end.lastDay } : {}),
    ...(start.time ? { startTime: start.time } : {}),
    ...(end?.time ? { endTime: end.time } : {}),
    url: safeHttpUrl(raw.url) ?? options.fallbackUrl,
    ...(location ? { location } : {}),
    ...(Object.keys(info).length > 0 ? { info } : {}),
    ...(notes ? { notes } : {}),
  };
}

interface ResolvedStart {
  readonly date: PlainDate;
  readonly time?: TimeOfDay;
  readonly ms?: number;
}

function resolveStart(time: RawEventTime, timeZone: string): ResolvedStart | undefined {
  if (time.date) {
    const date = parseIsoDate(time.date);
    return date ? { date } : undefined;
  }
  if (time.dateTime) {
    const ms = Date.parse(time.dateTime);
    if (Number.isNaN(ms)) return undefined;
    return { ...toZonedParts(new Date(ms), timeZone), ms };
  }
  return undefined;
}

/**
 * End times are exclusive: an all-day event ending on `2026-11-12` lasts
 * through the 11th; a timed event ending at 00:00 ends the day before, but its
 * end time is still shown as 00:00.
 */
function resolveEnd(
  time: RawEventTime,
  start: ResolvedStart,
  timeZone: string,
): { lastDay?: PlainDate; time?: TimeOfDay } | undefined {
  if (time.date) {
    const date = parseIsoDate(time.date);
    return date ? { lastDay: addDays(date, -1) } : undefined;
  }
  if (!time.dateTime) return undefined;
  const ms = Date.parse(time.dateTime);
  if (Number.isNaN(ms) || start.ms === undefined || ms <= start.ms) return undefined;
  const endTime = toZonedParts(new Date(ms), timeZone).time;
  const lastDay = toZonedParts(new Date(ms - 1), timeZone).date;
  const overnight =
    compareDates(lastDay, addDays(start.date, 1)) === 0 && endTime.hour < OVERNIGHT_END_HOUR;
  return { lastDay: overnight ? start.date : lastDay, time: endTime };
}

// ---- Validation helpers (remote data is untrusted) ----

type Json = Record<string, unknown>;

export const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null;
export const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

export function parseRawTime(v: unknown): RawEventTime | undefined {
  if (!isObject(v)) return undefined;
  const date = str(v.date);
  const dateTime = str(v.dateTime);
  return { ...(date ? { date } : {}), ...(dateTime ? { dateTime } : {}) };
}

/** Drops `undefined` fields so objects satisfy `exactOptionalPropertyTypes`. */
export function compact<T extends object>(fields: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

function parseIsoDate(value: string): PlainDate | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  try {
    return plainDate(Number(m[1]), Number(m[2]), Number(m[3]));
  } catch {
    return undefined;
  }
}

/** Only allow http(s) links: event data must never produce a `javascript:` href. */
export function safeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

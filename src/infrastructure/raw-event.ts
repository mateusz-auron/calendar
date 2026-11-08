import {
  addDays,
  compareDates,
  plainDate,
  type CalendarEvent,
  type PlainDate,
  type TimeOfDay,
} from '../domain';
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

/** Maps a raw event to the domain model; `undefined` for cancelled or malformed events. */
export function toCalendarEvent(
  raw: RawEvent,
  options: RawEventMappingOptions,
): CalendarEvent | undefined {
  if (raw.status?.toLowerCase() === 'cancelled' || !raw.start) return undefined;
  const start = resolve(raw.start, 'start', options.timeZone);
  if (!start) return undefined;
  const end = raw.end ? resolve(raw.end, 'end', options.timeZone) : undefined;

  const description = raw.description ? stripHtml(raw.description) : undefined;
  return {
    id: raw.id,
    title: raw.title?.trim() || '(No title)',
    date: start.date,
    ...(end && compareDates(end.date, start.date) > 0 ? { endDate: end.date } : {}),
    ...(start.time ? { startTime: start.time } : {}),
    url: safeHttpUrl(raw.url) ?? options.fallbackUrl,
    ...(description ? { description } : {}),
  };
}

/**
 * End times are exclusive: an all-day event ending on `2026-11-12` lasts
 * through the 11th; a timed event ending at 00:00 ends the day before.
 */
function resolve(
  time: RawEventTime,
  edge: 'start' | 'end',
  timeZone: string,
): { date: PlainDate; time?: TimeOfDay } | undefined {
  if (time.date) {
    const date = parseIsoDate(time.date);
    if (!date) return undefined;
    return { date: edge === 'end' ? addDays(date, -1) : date };
  }
  if (time.dateTime) {
    const ms = Date.parse(time.dateTime);
    if (Number.isNaN(ms)) return undefined;
    const parts = toZonedParts(new Date(edge === 'end' ? ms - 1 : ms), timeZone);
    return edge === 'start' ? parts : { date: parts.date };
  }
  return undefined;
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

/** Descriptions may contain HTML; we only ever show them as plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

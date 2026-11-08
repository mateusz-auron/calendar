import ICAL from 'ical.js';
import {
  addDays,
  addMonths,
  firstDayOf,
  fromJsDate,
  toIsoString,
  yearMonthOf,
} from '../../src/domain';
import { SNAPSHOT_VERSION, type EventSnapshot } from '../../src/infrastructure/event-snapshot';
import type { RawEvent, RawEventTime } from '../../src/infrastructure/raw-event';
import { toZonedParts } from '../../src/infrastructure/zoned-time';

export interface IcalToSnapshotOptions {
  /** "Now" — injected so output is deterministic in tests. */
  readonly now: Date;
  /** Whole months before the current one to include. */
  readonly pastMonths: number;
  /** Whole months after the current one to include. */
  readonly futureMonths: number;
  /** Google calendar ID, used to build links to Google Calendar event pages. */
  readonly calendarId?: string | undefined;
}

/** Hard cap per recurring series, protecting against pathological RRULEs. */
const MAX_OCCURRENCES_PER_SERIES = 5_000;

/**
 * Parses an iCalendar (RFC 5545) feed and expands it into a snapshot:
 * recurring events (RRULE/RDATE) become individual occurrences, EXDATEs are
 * removed and RECURRENCE-ID overrides replace the occurrences they modify.
 */
export function icalToSnapshot(ics: string, options: IcalToSnapshotOptions): EventSnapshot {
  if (!/^\s*BEGIN:VCALENDAR/i.test(ics)) {
    throw new Error('Not an iCalendar feed (is the calendar public and the URL correct?)');
  }
  const calendar = ICAL.Component.fromString(ics);
  for (const tz of calendar.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz);
  const calendarZone = stringProp(calendar, 'x-wr-timezone');

  const thisMonth = yearMonthOf(fromJsDate(options.now));
  const rangeStart = firstDayOf(addMonths(thisMonth, -options.pastMonths));
  const rangeEnd = addDays(firstDayOf(addMonths(thisMonth, options.futureMonths + 1)), -1);
  const windowStart = Date.UTC(rangeStart.year, rangeStart.month - 1, rangeStart.day) - 86_400_000;
  const windowEnd = Date.UTC(rangeEnd.year, rangeEnd.month - 1, rangeEnd.day) + 2 * 86_400_000;

  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const vevent of calendar.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(vevent);
    if (event.isRecurrenceException()) exceptions.push(event);
    else masters.set(event.uid, event);
  }
  const orphans: ICAL.Event[] = [];
  for (const exception of exceptions) {
    const master = masters.get(exception.uid);
    if (master?.isRecurring()) master.relateException(exception);
    else orphans.push(exception);
  }

  const toInstant = (time: ICAL.Time) => instantOf(time, calendarZone);
  const events: RawEvent[] = [];
  const emit = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time, recurrenceId?: ICAL.Time) => {
    const startMs = toInstant(start);
    const endMs = Math.max(toInstant(end), startMs);
    if (endMs < windowStart || startMs > windowEnd) return;
    if (stringProp(item.component, 'status')?.toUpperCase() === 'CANCELLED') return;
    const suffix = recurrenceId ? `_${occurrenceSuffix(recurrenceId, toInstant)}` : '';
    const url =
      stringProp(item.component, 'url') ?? googleEventUrl(item.uid, suffix, options.calendarId);
    const location = stringProp(item.component, 'location');
    events.push({
      id: `${item.uid}${suffix}`,
      title: item.summary,
      ...(item.description ? { description: item.description } : {}),
      ...(location ? { location } : {}),
      ...(url ? { url } : {}),
      start: rawTime(start, startMs),
      end: rawTime(end, endMs),
    });
  };

  for (const event of [...masters.values(), ...orphans]) {
    if (!event.component.hasProperty('dtstart')) continue;
    if (!event.isRecurring()) {
      emit(event, event.startDate, event.endDate);
      continue;
    }
    const iterator = event.iterator();
    for (let i = 0; i < MAX_OCCURRENCES_PER_SERIES; i++) {
      // Typed as non-null, but returns null once a finite series is exhausted.
      const next = iterator.next() as ICAL.Time | null;
      if (!next || toInstant(next) > windowEnd) break;
      const details = event.getOccurrenceDetails(next);
      emit(details.item, details.startDate, details.endDate, details.recurrenceId);
    }
  }

  events.sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.id.localeCompare(b.id));
  return {
    version: SNAPSHOT_VERSION,
    source: 'ical',
    generatedAt: options.now.toISOString(),
    range: { start: toIsoString(rangeStart), end: toIsoString(rangeEnd) },
    events,
  };
}

function stringProp(component: ICAL.Component, name: string): string | undefined {
  const value: unknown = component.getFirstPropertyValue(name);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function rawTime(time: ICAL.Time, instantMs: number): RawEventTime {
  return time.isDate ? { date: time.toString() } : { dateTime: new Date(instantMs).toISOString() };
}

function sortKey(e: RawEvent): string {
  return e.start?.dateTime ?? `${e.start?.date ?? ''}T00:00:00.000Z`;
}

/**
 * Instant of an iCal time. Times with a known zone (or UTC) are exact;
 * "floating" times (no zone) are read in the calendar's X-WR-TIMEZONE.
 */
function instantOf(time: ICAL.Time, calendarZone: string | undefined): number {
  // Typed as non-null, but absent for floating times.
  const zone = (time.zone as ICAL.Timezone | null | undefined)?.tzid;
  const isFloating = !zone || zone === 'floating';
  if (time.isDate || !isFloating || !calendarZone) return time.toJSDate().getTime();
  return wallClockToInstant(time, calendarZone);
}

/** Instant at which the wall clock in `timeZone` reads `time` (DST-aware, two refinement passes). */
function wallClockToInstant(time: ICAL.Time, timeZone: string): number {
  const wall = Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute);
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const { date, time: t } = toZonedParts(new Date(guess), timeZone);
    guess += wall - Date.UTC(date.year, date.month - 1, date.day, t.hour, t.minute);
  }
  return guess + time.second * 1000;
}

/** Google's per-occurrence id suffix: `20261116T080000Z` (timed, UTC) or `20261116` (all-day). */
function occurrenceSuffix(recurrenceId: ICAL.Time, toInstant: (t: ICAL.Time) => number): string {
  if (recurrenceId.isDate) return recurrenceId.toString().replaceAll('-', '');
  return new Date(toInstant(recurrenceId)).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
}

/**
 * Best-effort link to the event's page in Google Calendar, mirroring the API's
 * `htmlLink` (`eid` = base64("<event id> <calendar id>")). Only for Google feeds.
 */
function googleEventUrl(
  uid: string,
  suffix: string,
  calendarId: string | undefined,
): string | undefined {
  if (!calendarId || !uid.endsWith('@google.com')) return undefined;
  const eventId = `${uid.slice(0, -'@google.com'.length)}${suffix}`;
  const shortCalendarId = calendarId
    .replace(/@group\.calendar\.google\.com$/, '@g')
    .replace(/@gmail\.com$/, '@m');
  const eid = Buffer.from(`${eventId} ${shortCalendarId}`).toString('base64').replace(/=+$/, '');
  return `https://www.google.com/calendar/event?eid=${encodeURIComponent(eid)}`;
}

/** Extracts the calendar ID from a Google iCal URL (`/calendar/ical/<id>/public/basic.ics`). */
export function calendarIdFromIcalUrl(url: string): string | undefined {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== 'calendar.google.com') return undefined;
    const match = /\/calendar\/ical\/([^/]+)\//.exec(pathname);
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

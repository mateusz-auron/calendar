import {
  addDays,
  compareDates,
  overlaps,
  plainDate,
  toIsoString,
  type CalendarEvent,
  type DateRange,
  type EventRepository,
  type PlainDate,
  type TimeOfDay,
} from '../domain';
import { toZonedParts } from './zoned-time';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface GoogleCalendarOptions {
  /** e.g. `abc123@group.calendar.google.com`. The calendar must be public. */
  readonly calendarId: string;
  /** Browser API key restricted to the Calendar API and your HTTP referrers. */
  readonly apiKey: string;
  /** IANA zone used to place timed events on days, e.g. `Europe/Warsaw`. */
  readonly timeZone: string;
  /** Used when an event has no `htmlLink`. */
  readonly fallbackUrl: string;
  readonly fetch: FetchFn;
  readonly timeoutMs?: number;
}

/** Raised for any failure talking to Google, with a user-presentable message. */
export class EventSourceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'EventSourceError';
  }
}

const API_BASE = 'https://www.googleapis.com/calendar/v3/calendars';
const FIELDS = 'items(id,status,summary,description,htmlLink,start,end),nextPageToken';
const MAX_PAGES = 10;

/**
 * Adapter: reads a **public** Google Calendar through the Calendar API v3
 * (`events.list`, recurring events expanded by Google via `singleEvents=true`).
 */
export class GoogleCalendarEventRepository implements EventRepository {
  constructor(private readonly options: GoogleCalendarOptions) {}

  async findInRange(range: DateRange): Promise<readonly CalendarEvent[]> {
    const events: CalendarEvent[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await this.request(this.buildUrl(range, pageToken));
      for (const item of body.items) {
        const event = this.toCalendarEvent(item);
        if (event && overlaps(range, event.date, event.endDate ?? event.date)) events.push(event);
      }
      pageToken = body.nextPageToken;
      if (!pageToken) break;
    }
    return events;
  }

  private buildUrl(range: DateRange, pageToken: string | undefined): string {
    // Pad by a day on each side: timed events are placed on days in `timeZone`
    // afterwards, and anything outside the range is filtered out above.
    const params = new URLSearchParams({
      key: this.options.apiKey,
      timeMin: `${toIsoString(addDays(range.start, -1))}T00:00:00Z`,
      timeMax: `${toIsoString(addDays(range.end, 2))}T00:00:00Z`,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
      fields: FIELDS,
    });
    if (pageToken) params.set('pageToken', pageToken);
    return `${API_BASE}/${encodeURIComponent(this.options.calendarId)}/events?${params.toString()}`;
  }

  private async request(url: string): Promise<GoogleEventsPage> {
    let response: Response;
    try {
      response = await this.options.fetch(url, {
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
      });
    } catch {
      throw new EventSourceError('Could not reach Google Calendar.');
    }
    const json: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new EventSourceError(describeError(response.status, json), response.status);
    }
    return parsePage(json);
  }

  private toCalendarEvent(item: GoogleEvent): CalendarEvent | undefined {
    if (item.status === 'cancelled' || !item.start) return undefined;
    const start = this.resolve(item.start, 'start');
    if (!start) return undefined;
    const end = item.end ? this.resolve(item.end, 'end') : undefined;

    const description = item.description ? stripHtml(item.description) : undefined;
    return {
      id: item.id,
      title: item.summary?.trim() || '(No title)',
      date: start.date,
      ...(end && compareDates(end.date, start.date) > 0 ? { endDate: end.date } : {}),
      ...(start.time ? { startTime: start.time } : {}),
      url: item.htmlLink ?? this.options.fallbackUrl,
      ...(description ? { description } : {}),
    };
  }

  /**
   * Google end times are exclusive: an all-day event ending on `2026-11-12`
   * lasts through the 11th; a timed event ending at 00:00 ends the day before.
   */
  private resolve(
    time: GoogleEventTime,
    edge: 'start' | 'end',
  ): { date: PlainDate; time?: TimeOfDay } | undefined {
    if (time.date) {
      const date = parseIsoDate(time.date);
      if (!date) return undefined;
      return { date: edge === 'end' ? addDays(date, -1) : date };
    }
    if (time.dateTime) {
      const ms = Date.parse(time.dateTime);
      if (Number.isNaN(ms)) return undefined;
      const parts = toZonedParts(new Date(edge === 'end' ? ms - 1 : ms), this.options.timeZone);
      return edge === 'start' ? parts : { date: parts.date };
    }
    return undefined;
  }
}

// ---- Response parsing (validate at the boundary; never trust remote JSON) ----

interface GoogleEventTime {
  readonly date?: string;
  readonly dateTime?: string;
}

interface GoogleEvent {
  readonly id: string;
  readonly status?: string;
  readonly summary?: string;
  readonly description?: string;
  readonly htmlLink?: string;
  readonly start?: GoogleEventTime;
  readonly end?: GoogleEventTime;
}

interface GoogleEventsPage {
  readonly items: readonly GoogleEvent[];
  readonly nextPageToken?: string;
}

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null;
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

function parseTime(v: unknown): GoogleEventTime | undefined {
  if (!isObject(v)) return undefined;
  const date = str(v.date);
  const dateTime = str(v.dateTime);
  return { ...(date ? { date } : {}), ...(dateTime ? { dateTime } : {}) };
}

function parseEvent(v: unknown): GoogleEvent | undefined {
  if (!isObject(v)) return undefined;
  const id = str(v.id);
  if (!id) return undefined;
  const fields = {
    status: str(v.status),
    summary: str(v.summary),
    description: str(v.description),
    htmlLink: safeHttpUrl(str(v.htmlLink)),
    start: parseTime(v.start),
    end: parseTime(v.end),
  };
  return {
    id,
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
  };
}

function parsePage(json: unknown): GoogleEventsPage {
  if (!isObject(json)) throw new EventSourceError('Unexpected response from Google Calendar.');
  const items = Array.isArray(json.items) ? json.items : [];
  const nextPageToken = str(json.nextPageToken);
  return {
    items: items.map(parseEvent).filter((e): e is GoogleEvent => e !== undefined),
    ...(nextPageToken ? { nextPageToken } : {}),
  };
}

function describeError(status: number, json: unknown): string {
  const detail = isObject(json) && isObject(json.error) ? str(json.error.message) : undefined;
  const hint =
    status === 404
      ? 'Calendar not found or not public.'
      : status === 403 || status === 400
        ? 'Access denied — check the API key and its restrictions.'
        : `Google Calendar request failed (HTTP ${String(status)}).`;
  return detail ? `${hint} ${detail}` : hint;
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
function safeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Google descriptions may contain HTML; we only ever show them as plain text. */
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

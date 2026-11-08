import {
  addDays,
  overlaps,
  toIsoString,
  type CalendarEvent,
  type DateRange,
  type EventRepository,
} from '../domain';
import { EventSourceError } from './event-source-error';
import { compact, isObject, parseRawTime, str, toCalendarEvent, type RawEvent } from './raw-event';

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

const API_BASE = 'https://www.googleapis.com/calendar/v3/calendars';
const FIELDS = 'items(id,status,summary,description,htmlLink,start,end),nextPageToken';
const MAX_PAGES = 10;

interface GoogleEventsPage {
  readonly items: readonly RawEvent[];
  readonly nextPageToken?: string;
}

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
        const event = toCalendarEvent(item, this.options);
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
}

// ---- Response parsing (validate at the boundary; never trust remote JSON) ----

function parseGoogleEvent(v: unknown): RawEvent | undefined {
  if (!isObject(v)) return undefined;
  const id = str(v.id);
  if (!id) return undefined;
  return {
    id,
    ...compact({
      status: str(v.status),
      title: str(v.summary),
      description: str(v.description),
      url: str(v.htmlLink),
      start: parseRawTime(v.start),
      end: parseRawTime(v.end),
    }),
  };
}

function parsePage(json: unknown): GoogleEventsPage {
  if (!isObject(json)) throw new EventSourceError('Unexpected response from Google Calendar.');
  const items = Array.isArray(json.items) ? json.items : [];
  const nextPageToken = str(json.nextPageToken);
  return {
    items: items.map(parseGoogleEvent).filter((e): e is RawEvent => e !== undefined),
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

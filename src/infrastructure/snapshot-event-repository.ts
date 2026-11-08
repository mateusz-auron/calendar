import { overlaps, type CalendarEvent, type DateRange, type EventRepository } from '../domain';
import { EventSourceError } from './event-source-error';
import { parseSnapshot } from './event-snapshot';
import type { FetchFn } from './google-calendar-event-repository';
import { toCalendarEvent } from './raw-event';

export interface SnapshotOptions {
  /** URL of `events.json`, relative to the page (works under any Pages sub-path). */
  readonly url: string;
  readonly timeZone: string;
  readonly fallbackUrl: string;
  readonly fetch: FetchFn;
  readonly timeoutMs?: number;
}

/**
 * Adapter: serves events from the static snapshot produced by the scheduled
 * iCal sync. The file is downloaded once per page load and filtered locally.
 */
export class SnapshotEventRepository implements EventRepository {
  private events: Promise<readonly CalendarEvent[]> | undefined;

  constructor(private readonly options: SnapshotOptions) {}

  async findInRange(range: DateRange): Promise<readonly CalendarEvent[]> {
    const all = await this.load();
    return all.filter((e) => overlaps(range, e.date, e.endDate ?? e.date));
  }

  private load(): Promise<readonly CalendarEvent[]> {
    this.events ??= this.download().catch((error: unknown) => {
      this.events = undefined; // allow Retry after a failure
      throw error;
    });
    return this.events;
  }

  private async download(): Promise<readonly CalendarEvent[]> {
    let response: Response;
    try {
      // `no-cache` revalidates with the server, so a fresh sync shows up as
      // soon as GitHub Pages' CDN serves it (up to ~10 min).
      response = await this.options.fetch(this.options.url, {
        cache: 'no-cache',
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
      });
    } catch {
      throw new EventSourceError('Could not load the events file.');
    }
    if (!response.ok) {
      throw new EventSourceError(
        response.status === 404
          ? 'No synced events yet — run the iCal sync.'
          : `Loading events failed (HTTP ${String(response.status)}).`,
        response.status,
      );
    }
    const json: unknown = await response.json().catch(() => undefined);
    return parseSnapshot(json)
      .events.map((raw) => toCalendarEvent(raw, this.options))
      .filter((e): e is CalendarEvent => e !== undefined);
  }
}

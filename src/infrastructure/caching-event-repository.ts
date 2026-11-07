import { toIsoString, type CalendarEvent, type DateRange, type EventRepository } from '../domain';

/**
 * Decorator: memoises another repository per date range, so navigating back
 * and forth doesn't re-fetch. Failed requests are evicted so they can be retried.
 */
export class CachingEventRepository implements EventRepository {
  private readonly cache = new Map<string, Promise<readonly CalendarEvent[]>>();

  constructor(
    private readonly inner: EventRepository,
    private readonly maxEntries = 24,
  ) {}

  findInRange(range: DateRange): Promise<readonly CalendarEvent[]> {
    const key = `${toIsoString(range.start)}/${toIsoString(range.end)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const pending = this.inner.findInRange(range);
    this.cache.set(key, pending);
    pending.catch(() => this.cache.delete(key));
    if (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return pending;
  }
}

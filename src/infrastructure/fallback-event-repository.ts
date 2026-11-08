import type { CalendarEvent, DateRange, EventRepository } from '../domain';

/**
 * Decorator: tries `primary` (e.g. live Google API) and falls back to
 * `secondary` (e.g. the iCal snapshot) when it fails. If both fail, the
 * primary's error is reported, as it is usually the more informative one.
 */
export class FallbackEventRepository implements EventRepository {
  constructor(
    private readonly primary: EventRepository,
    private readonly secondary: EventRepository,
    private readonly onFallback: (error: unknown) => void = () => undefined,
  ) {}

  async findInRange(range: DateRange): Promise<readonly CalendarEvent[]> {
    try {
      return await this.primary.findInRange(range);
    } catch (primaryError) {
      this.onFallback(primaryError);
      try {
        return await this.secondary.findInRange(range);
      } catch {
        throw primaryError;
      }
    }
  }
}

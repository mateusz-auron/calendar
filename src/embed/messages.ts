import {
  parseGameFilter,
  parseYearMonth,
  plainDate,
  toIsoString,
  toYearMonthString,
  type GameFilter,
  type PlainDate,
  type YearMonth,
} from '../domain';

/**
 * Messages between the calendar, the host page (public/embed.js) and the
 * details layer (the calendar loaded with `?mode=details`). Shapes are a
 * contract with host pages: see README, "Message contract".
 */
export const MSG = {
  resize: 'calendar:resize',
  focus: 'calendar:focus',
  hello: 'calendar:hello',
  host: 'calendar:host',
  month: 'calendar:month',
  details: 'calendar:details',
  detailsReady: 'calendar:details-ready',
  detailsShown: 'calendar:details-shown',
  detailsClosed: 'calendar:details-closed',
  detailsCancel: 'calendar:details-cancel',
  detailsFallback: 'calendar:details-fallback',
} as const;

/** "Show the details of this event, or of every event on this day". */
export interface DetailsRequestData {
  readonly date: PlainDate;
  readonly eventId?: string;
  readonly filter: GameFilter;
}

export type Message = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is Message {
  return typeof value === 'object' && value !== null;
}

/** Messages are accepted only from the parent window and, if configured, its origin. */
export function fromParent(win: Window, targetOrigin: string, event: MessageEvent): boolean {
  return event.source === win.parent && (targetOrigin === '*' || event.origin === targetOrigin);
}

export function encodeRequest(request: DetailsRequestData): Message {
  return {
    date: toIsoString(request.date),
    filter: request.filter,
    ...(request.eventId !== undefined ? { eventId: request.eventId } : {}),
  };
}

const MAX_ID_LENGTH = 1024;

export function decodeRequest(data: Message): DetailsRequestData | undefined {
  const date = parseDate(data.date);
  if (!date) return undefined;
  const eventId = data.eventId;
  if (eventId !== undefined && (typeof eventId !== 'string' || eventId.length > MAX_ID_LENGTH)) {
    return undefined;
  }
  return {
    date,
    filter: parseGameFilter(typeof data.filter === 'string' ? data.filter : undefined),
    ...(typeof eventId === 'string' ? { eventId } : {}),
  };
}

export function encodeMonth(month: YearMonth): string {
  return toYearMonthString(month);
}

export function decodeMonth(value: unknown): YearMonth | undefined {
  return typeof value === 'string' ? parseYearMonth(value) : undefined;
}

function parseDate(value: unknown): PlainDate | undefined {
  if (typeof value !== 'string') return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  try {
    return plainDate(Number(m[1]), Number(m[2]), Number(m[3]));
  } catch {
    return undefined;
  }
}

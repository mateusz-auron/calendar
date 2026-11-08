import type { GameFilter, YearMonth } from '../domain';
import {
  MSG,
  decodeMonth,
  decodeRequest,
  encodeMonth,
  encodeRequest,
  fromParent,
  isRecord,
  type DetailsRequestData,
} from './messages';

export interface DetailsBridgeHandlers {
  /** The details layer closed: restore focus in the calendar. */
  readonly onClosed: (eventId: string | undefined) => void;
  /** Prev/next in the details layer moved to another month: follow it behind the layer. */
  readonly onMonth: (month: YearMonth) => void;
  /** The layer did not answer in time: open the details in this page instead. */
  readonly onFallback: (request: DetailsRequestData) => void;
}

/**
 * Main calendar side of the details layer. When the host page runs
 * public/embed.js, event details open in a separate full-screen iframe that
 * the host keeps ready (the calendar in `?mode=details`), so the backdrop
 * covers the whole page, sits above the page's own bars and uses the full
 * width on phones. This iframe never moves, so nothing flickers.
 *
 * Without the host script nothing changes: `open()` returns false and the
 * details open inside this iframe.
 */
export class DetailsBridge {
  private supported = false;
  private readonly onMessage = (event: MessageEvent) => {
    this.handle(event);
  };

  constructor(
    private readonly win: Window,
    private readonly targetOrigin: string,
    private readonly handlers: DetailsBridgeHandlers,
  ) {}

  start(): void {
    if (this.win.parent === this.win) return;
    this.win.addEventListener('message', this.onMessage);
    this.post({ type: MSG.hello });
  }

  stop(): void {
    this.win.removeEventListener('message', this.onMessage);
  }

  /** Hands the request to the details layer; false when there is none. */
  open(request: DetailsRequestData): boolean {
    if (!this.supported) return false;
    this.post({ type: MSG.details, ...encodeRequest(request) });
    return true;
  }

  /** Lets the details layer load the month the visitor is looking at ahead of time. */
  monthShown(month: YearMonth, filter: GameFilter): void {
    if (this.supported) this.post({ type: MSG.month, month: encodeMonth(month), filter });
  }

  private handle(event: MessageEvent): void {
    if (!fromParent(this.win, this.targetOrigin, event)) return;
    const data: unknown = event.data;
    if (!isRecord(data)) return;
    switch (data.type) {
      case MSG.host:
        this.supported = data.details === true;
        break;
      case MSG.detailsClosed:
        this.handlers.onClosed(typeof data.eventId === 'string' ? data.eventId : undefined);
        break;
      case MSG.month: {
        const month = decodeMonth(data.month);
        if (month) this.handlers.onMonth(month);
        break;
      }
      case MSG.detailsFallback: {
        const request = isRecord(data.request) ? decodeRequest(data.request) : undefined;
        if (request) this.handlers.onFallback(request);
        break;
      }
    }
  }

  private post(message: Record<string, unknown>): void {
    this.win.parent.postMessage(message, this.targetOrigin);
  }
}

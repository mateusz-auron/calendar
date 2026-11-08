import { parseGameFilter, type GameFilter, type YearMonth } from '../domain';
import {
  MSG,
  decodeMonth,
  decodeRequest,
  encodeMonth,
  fromParent,
  isRecord,
  type DetailsRequestData,
} from './messages';

export interface DetailsPageHandlers {
  /** Open these details (the layer is still invisible; call `ready()` once shown). */
  readonly onRequest: (request: DetailsRequestData) => void;
  /** The main calendar shows this month: load it ahead of time. */
  readonly onPrefetch: (month: YearMonth, filter: GameFilter) => void;
  /** The host made the layer visible: move focus into the dialog. */
  readonly onShown: () => void;
  /** The host gave up waiting (the calendar opened the details itself): close the dialog. */
  readonly onCancel: () => void;
}

/**
 * The details layer: the calendar loaded with `?mode=details` in a transparent,
 * full-screen iframe that the host page keeps ready. It shows only the event
 * dialog (with its backdrop) and talks to the host page (public/embed.js).
 */
export class DetailsPageClient {
  private readonly onMessage = (event: MessageEvent) => {
    this.handle(event);
  };
  private readonly blockScroll = (event: Event) => {
    const target = event.target;
    const inside = target instanceof Element && target.closest('.cal-dialog__scroll') !== null;
    if (!inside && event.cancelable) event.preventDefault();
  };
  private containing = false;

  constructor(
    private readonly win: Window,
    private readonly targetOrigin: string,
    private readonly handlers: DetailsPageHandlers,
  ) {}

  start(): void {
    if (this.win.parent === this.win) return;
    this.win.addEventListener('message', this.onMessage);
    this.post({ type: MSG.hello, role: 'details' });
  }

  stop(): void {
    this.win.removeEventListener('message', this.onMessage);
    this.containScrolling(false);
  }

  /** The dialog is open: the host may show the layer. */
  ready(): void {
    this.post({ type: MSG.detailsReady });
  }

  /** The dialog closed (or the request could not be shown): the host hides the layer. */
  closed(eventId: string | undefined): void {
    this.containScrolling(false);
    this.post({ type: MSG.detailsClosed, ...(eventId !== undefined ? { eventId } : {}) });
  }

  /** Prev/next switched months: the main calendar follows behind the layer. */
  navigated(month: YearMonth): void {
    this.post({ type: MSG.month, month: encodeMonth(month) });
  }

  private handle(event: MessageEvent): void {
    if (!fromParent(this.win, this.targetOrigin, event)) return;
    const data: unknown = event.data;
    if (!isRecord(data)) return;
    switch (data.type) {
      case MSG.details: {
        const request = decodeRequest(data);
        if (request) this.handlers.onRequest(request);
        else this.closed(undefined);
        break;
      }
      case MSG.month: {
        const month = decodeMonth(data.month);
        const filter = parseGameFilter(typeof data.filter === 'string' ? data.filter : undefined);
        if (month) this.handlers.onPrefetch(month, filter);
        break;
      }
      case MSG.detailsShown:
        this.containScrolling(true);
        this.handlers.onShown();
        break;
      case MSG.detailsCancel:
        this.handlers.onCancel();
        break;
    }
  }

  /**
   * While the layer is visible it covers the host page: wheel and touch
   * scrolling outside the dialog's own scroll area must not scroll the page
   * behind it. Only while visible: a non-passive touch listener in a hidden
   * cross-origin iframe can otherwise block scrolling of the whole page.
   */
  private containScrolling(on: boolean): void {
    if (on === this.containing) return;
    this.containing = on;
    const doc = this.win.document;
    if (on) {
      doc.addEventListener('wheel', this.blockScroll, { passive: false });
      doc.addEventListener('touchmove', this.blockScroll, { passive: false });
    } else {
      doc.removeEventListener('wheel', this.blockScroll);
      doc.removeEventListener('touchmove', this.blockScroll);
    }
  }

  private post(message: Record<string, unknown>): void {
    this.win.parent.postMessage(message, this.targetOrigin);
  }
}

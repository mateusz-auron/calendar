import type { CalendarService, EventCard, MonthView } from '../application';
import {
  addMonths,
  isSameDate,
  isSameYearMonth,
  yearMonthOf,
  type Clock,
  type EventLinks,
  type GameFilter,
  type PlainDate,
  type Weekday,
  type YearMonth,
} from '../domain';
import type { CalendarFormatter } from './calendar-formatter';
import { h } from './dom';
import { EventDialog } from './event-dialog';
import { EventText } from './event-text';
import { renderGameFilter } from './game-filter';
import type { Messages } from './messages';
import { renderMonthGrid } from './month-grid-view';
import { renderMonthHeader } from './month-header';

export interface CalendarViewDeps {
  readonly root: HTMLElement;
  readonly service: CalendarService;
  readonly formatter: CalendarFormatter;
  readonly messages: Messages;
  readonly links: EventLinks;
  readonly clock: Clock;
  readonly weekStartsOn: Weekday;
  readonly initialFilter?: GameFilter;
  /** Element that holds the details dialog (default: the document body). */
  readonly dialogHost?: HTMLElement;
  /**
   * Embedded with a separate details layer (see embed/details-bridge.ts): the
   * details open there instead of in this page. Returns false to open them here.
   */
  readonly detailsDelegate?: (request: DetailsRequest) => boolean;
  /** Called after every render — e.g. to notify an iframe host of size changes. */
  readonly onRender?: () => void;
  /** After a month was loaded and shown. */
  readonly onMonthShown?: (month: YearMonth, filter: GameFilter) => void;
  /** Prev/next in the dialog switched to another month. */
  readonly onEventNavigated?: (month: YearMonth) => void;
  readonly onDetailsShown?: () => void;
  readonly onDetailsClosed?: (eventId: string | undefined) => void;
}

/** "Show the details of this event (or of all events on this day)". */
export interface DetailsRequest {
  readonly date: PlainDate;
  readonly eventId?: string;
  readonly filter: GameFilter;
}

/**
 * Month calendar with a game filter and an event details dialog. Handles
 * navigation, loading and errors; `show()` never rejects.
 */
export class CalendarView {
  private current: YearMonth;
  private filter: GameFilter;
  private view: MonthView | undefined;
  private renderToken = 0;
  private neighbourToken = 0;
  private readonly text: EventText;
  private readonly dialog: EventDialog;
  /** The tile that asked a details layer to open, for focus when it closes. */
  private delegatedTrigger: HTMLElement | null = null;

  constructor(
    private readonly deps: CalendarViewDeps,
    initialMonth?: YearMonth,
  ) {
    this.current = initialMonth ?? yearMonthOf(deps.clock.today());
    this.filter = deps.initialFilter ?? 'all';
    this.text = new EventText(deps.formatter, deps.messages);
    this.dialog = new EventDialog({
      host: deps.dialogHost ?? deps.root.ownerDocument.body,
      formatter: deps.formatter,
      text: this.text,
      messages: deps.messages,
      links: deps.links,
      onNavigate: (direction) => void this.navigateEvent(direction),
      fallbackFocus: () => deps.root.querySelector<HTMLElement>('.calendar__title'),
      onShown: () => deps.onDetailsShown?.(),
      onClosed: (eventId) => deps.onDetailsClosed?.(eventId),
    });
  }

  get month(): YearMonth {
    return this.current;
  }

  get activeFilter(): GameFilter {
    return this.filter;
  }

  /** The `<dialog>` element (for embedding and tests). */
  get dialogElement(): HTMLDialogElement {
    return this.dialog.element;
  }

  /** Never rejects: failures are rendered as an error state with a retry button. */
  async show(month: YearMonth): Promise<void> {
    this.current = month;
    const token = ++this.renderToken;
    const { root } = this.deps;
    root.setAttribute('aria-busy', 'true');
    if (!root.hasChildNodes()) this.render(this.renderStatus(month, this.deps.messages.loading));

    try {
      const view = await this.deps.service.getMonthView(month, this.filter);
      if (token !== this.renderToken) return; // a newer navigation won the race
      this.view = view;
      this.render(this.renderCalendar(view));
      this.deps.onMonthShown?.(month, this.filter);
    } catch (error) {
      if (token !== this.renderToken) return;
      console.error('[calendar] failed to load events', error);
      const detail = error instanceof Error ? error.message : undefined;
      this.render(this.renderStatus(month, this.deps.messages.loadError, detail));
    } finally {
      if (token === this.renderToken) root.removeAttribute('aria-busy');
    }
  }

  next(): Promise<void> {
    this.dialog.close();
    return this.show(addMonths(this.current, 1));
  }

  previous(): Promise<void> {
    this.dialog.close();
    return this.show(addMonths(this.current, -1));
  }

  today(): Promise<void> {
    this.dialog.close();
    return this.show(yearMonthOf(this.deps.clock.today()));
  }

  retry(): Promise<void> {
    return this.show(this.current);
  }

  setFilter(filter: GameFilter): Promise<void> {
    this.dialog.close();
    this.filter = filter;
    return this.show(this.current);
  }

  openEvent(card: EventCard, trigger: HTMLElement | null = null, here = false): void {
    if (!here && this.delegate({ date: card.event.date, eventId: card.event.id }, trigger)) return;
    const month = yearMonthOf(card.event.date);
    // "n / N" counts the events of the event's own month, which may not be the month on
    // screen (a December event in January's first row). The visible month is known already.
    const visible = this.view && isSameYearMonth(this.view.month, month) ? this.view : undefined;
    this.dialog.openEvent(
      card,
      trigger,
      visible ? positionIn(visible.monthEvents, card) : undefined,
    );
    if (!visible) void this.loadPosition(card, month);
    void this.loadNeighbours(card);
  }

  openDay(date: PlainDate, cards: readonly EventCard[], trigger: HTMLElement | null = null): void {
    if (cards.length === 1 && cards[0]) this.openEvent(cards[0], trigger);
    else if (cards.length > 1 && !this.delegate({ date }, trigger)) {
      this.dialog.openDay(date, cards, trigger);
    }
  }

  /** Prev/next inside the dialog; switches the month behind it when needed. */
  async navigateEvent(direction: 1 | -1): Promise<void> {
    const card = this.dialog.event;
    if (!card) return;
    const target = await this.deps.service.findAdjacentEvent(card.event, direction, this.filter);
    if (!target || this.dialog.event !== card) return;
    const month = yearMonthOf(target.event.date);
    if (!isSameYearMonth(month, this.current)) {
      await this.show(month);
      this.deps.onEventNavigated?.(month);
    }
    this.openEvent(target, null, true);
  }

  /**
   * Opens the details a request names, in this page (details layer, or a
   * fallback when the layer did not answer). Resolves false if not found.
   */
  async openRequest(request: DetailsRequest): Promise<boolean> {
    const filterChanged = request.filter !== this.filter;
    this.filter = request.filter;
    let cell = this.cellOf(request.date);
    if (!cell || filterChanged) {
      await this.show(yearMonthOf(request.date));
      cell = this.cellOf(request.date);
    }
    const cards = cell?.events ?? [];
    if (request.eventId !== undefined) {
      const card = cards.find((c) => c.event.id === request.eventId);
      if (!card) return false;
      this.openEvent(card, null, true);
      return true;
    }
    if (cards.length === 0) return false;
    if (cards.length === 1 && cards[0]) this.openEvent(cards[0], null, true);
    else this.dialog.openDay(request.date, cards, null);
    return true;
  }

  /** Details layer: load a month ahead of time (ignored while details are open). */
  async prefetch(month: YearMonth, filter: GameFilter): Promise<void> {
    if (this.dialog.isOpen) return;
    this.filter = filter;
    await this.show(month);
  }

  closeDetails(): void {
    this.dialog.close();
  }

  /** Details layer: move focus into the dialog once the layer is visible. */
  focusDetails(): void {
    this.dialog.focusContent();
  }

  /** After a details layer closed: focus the tile that opened it (or that event's tile). */
  restoreFocus(eventId: string | undefined): void {
    const trigger = this.delegatedTrigger;
    this.delegatedTrigger = null;
    if (trigger?.isConnected) {
      trigger.focus();
      return;
    }
    const tiles = eventId
      ? [...this.deps.root.querySelectorAll<HTMLElement>('[data-event-id]')].filter(
          (el) => el.dataset.eventId === eventId,
        )
      : [];
    const visible = tiles.find((el) => el.getClientRects().length > 0) ?? tiles[0];
    (visible ?? this.deps.root.querySelector<HTMLElement>('.calendar__title'))?.focus();
  }

  private delegate(
    request: { date: PlainDate; eventId?: string },
    trigger: HTMLElement | null,
  ): boolean {
    if (!this.deps.detailsDelegate?.({ ...request, filter: this.filter })) return false;
    this.delegatedTrigger = trigger;
    return true;
  }

  private cellOf(date: PlainDate) {
    return this.view?.weeks.flatMap((week) => week.days).find((day) => isSameDate(day.date, date));
  }

  /** Position of an event from a neighbouring month (served from the cache in practice). */
  private async loadPosition(card: EventCard, month: YearMonth): Promise<void> {
    try {
      const view = await this.deps.service.getMonthView(month, this.filter);
      this.dialog.setPosition(card, positionIn(view.monthEvents, card));
    } catch (error) {
      console.warn('[calendar] could not load the event position', error);
    }
  }

  private async loadNeighbours(card: EventCard): Promise<void> {
    const token = ++this.neighbourToken;
    try {
      const [previous, next] = await Promise.all([
        this.deps.service.findAdjacentEvent(card.event, -1, this.filter),
        this.deps.service.findAdjacentEvent(card.event, 1, this.filter),
      ]);
      if (token !== this.neighbourToken) return;
      this.dialog.setNeighbours(card, {
        ...(previous ? { previous } : {}),
        ...(next ? { next } : {}),
      });
    } catch (error) {
      console.warn('[calendar] could not load neighbouring events', error);
    }
  }

  private render(node: Node): void {
    this.deps.root.replaceChildren(node);
    this.deps.onRender?.();
  }

  private header(month: YearMonth, view?: MonthView): HTMLElement {
    const { formatter, messages } = this.deps;
    return renderMonthHeader({
      monthName: formatter.monthName(month),
      year: String(month.year),
      ...(view ? { countLabel: messages.eventsInMonth(view.monthEvents.length) } : {}),
      messages,
      onPrevious: () => void this.previous(),
      onToday: () => void this.today(),
      onNext: () => void this.next(),
      ...(view
        ? {
            filter: renderGameFilter({
              active: view.filter,
              counts: view.counts,
              messages,
              onPick: (filter) => void this.setFilter(filter),
            }),
          }
        : {}),
    });
  }

  private renderCalendar(view: MonthView): HTMLElement {
    const { formatter, messages } = this.deps;
    const emptyFiltered = view.filter !== 'all' && view.monthEvents.length === 0;
    let showAll: HTMLButtonElement | null = null;
    if (emptyFiltered) {
      showAll = h('button', { type: 'button', class: 'cal-empty__btn' }, messages.showAll);
      showAll.addEventListener('click', () => void this.setFilter('all'));
    }
    return h(
      'section',
      { class: 'calendar', 'aria-label': formatter.month(view.month) },
      this.header(view.month, view),
      emptyFiltered
        ? h(
            'div',
            { class: 'cal-empty', role: 'status' },
            h('p', {}, messages.emptyFiltered),
            showAll,
          )
        : null,
      renderMonthGrid({
        view,
        weekdays: formatter.weekdays(this.deps.weekStartsOn),
        formatter,
        text: this.text,
        messages,
        onOpenEvent: (card, trigger) => {
          this.openEvent(card, trigger);
        },
        onOpenDay: (date, cards, trigger) => {
          this.openDay(date, cards, trigger);
        },
      }),
      h('p', { class: 'cal-foot' }, messages.footNote),
    );
  }

  private renderStatus(month: YearMonth, message: string, errorDetail?: string): HTMLElement {
    const isError = errorDetail !== undefined;
    const retry = isError
      ? h(
          'button',
          { type: 'button', class: 'calendar__retry cal-empty__btn' },
          this.deps.messages.retry,
        )
      : null;
    retry?.addEventListener('click', () => void this.retry());
    return h(
      'section',
      { class: 'calendar', 'aria-label': this.deps.formatter.month(month) },
      this.header(month),
      h(
        'div',
        {
          class: `cal-status${isError ? ' cal-status--error' : ''}`,
          role: isError ? 'alert' : 'status',
        },
        h('p', {}, message),
        errorDetail ? h('p', { class: 'cal-status__detail' }, errorDetail) : null,
        retry,
      ),
    );
  }
}

function positionIn(
  events: readonly EventCard[],
  card: EventCard,
): { index: number; total: number } | undefined {
  const index = events.findIndex((e) => e.event.id === card.event.id);
  return index >= 0 ? { index, total: events.length } : undefined;
}

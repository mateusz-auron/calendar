import type { CalendarService, DayCell, MonthView } from '../application';
import {
  addMonths,
  toIsoString,
  yearMonthOf,
  type CalendarEvent,
  type Clock,
  type Weekday,
  type YearMonth,
} from '../domain';
import type { CalendarFormatter } from './calendar-formatter';
import { h } from './dom';

const UNTITLED = '(No title)';

export interface CalendarViewDeps {
  readonly root: HTMLElement;
  readonly service: CalendarService;
  readonly formatter: CalendarFormatter;
  readonly clock: Clock;
  readonly weekStartsOn: Weekday;
  /** Called after every render — e.g. to notify an iframe host of size changes. */
  readonly onRender?: () => void;
}

/**
 * Renders the interactive month grid and handles navigation, loading and errors.
 * Events are real `<a target="_blank">` links: accessible, keyboard-friendly,
 * middle-clickable, and not blocked as popups inside iframes.
 */
export class CalendarView {
  private current: YearMonth;
  private renderToken = 0;

  constructor(
    private readonly deps: CalendarViewDeps,
    initialMonth?: YearMonth,
  ) {
    this.current = initialMonth ?? yearMonthOf(deps.clock.today());
  }

  get month(): YearMonth {
    return this.current;
  }

  /** Never rejects: failures are rendered as an error state with a retry button. */
  async show(month: YearMonth): Promise<void> {
    this.current = month;
    const token = ++this.renderToken;
    const { root } = this.deps;
    root.setAttribute('aria-busy', 'true');
    if (!root.hasChildNodes()) this.render(this.renderStatus(month, 'Loading events…', false));

    try {
      const view = await this.deps.service.getMonthView(month);
      if (token !== this.renderToken) return; // a newer navigation won the race
      this.render(this.renderCalendar(view));
    } catch (error) {
      if (token !== this.renderToken) return;
      console.error('[calendar] failed to load events', error);
      const message = error instanceof Error ? error.message : 'Unknown error.';
      this.render(this.renderStatus(month, `Could not load events. ${message}`, true));
    } finally {
      if (token === this.renderToken) root.removeAttribute('aria-busy');
    }
  }

  next(): Promise<void> {
    return this.show(addMonths(this.current, 1));
  }

  previous(): Promise<void> {
    return this.show(addMonths(this.current, -1));
  }

  today(): Promise<void> {
    return this.show(yearMonthOf(this.deps.clock.today()));
  }

  retry(): Promise<void> {
    return this.show(this.current);
  }

  private render(node: Node): void {
    this.deps.root.replaceChildren(node);
    this.deps.onRender?.();
  }

  private renderCalendar(view: MonthView): HTMLElement {
    const title = this.deps.formatter.month(view.month);
    return h(
      'section',
      { class: 'calendar', 'aria-label': title },
      this.renderHeader(title),
      this.renderGrid(view),
    );
  }

  private renderStatus(month: YearMonth, message: string, isError: boolean): HTMLElement {
    const title = this.deps.formatter.month(month);
    const retry = isError
      ? h('button', { type: 'button', class: 'calendar__nav calendar__retry' }, 'Retry')
      : null;
    retry?.addEventListener('click', () => void this.retry());
    return h(
      'section',
      { class: 'calendar', 'aria-label': title },
      this.renderHeader(title),
      h(
        'div',
        {
          class: `calendar__status${isError ? ' calendar__status--error' : ''}`,
          role: isError ? 'alert' : 'status',
        },
        h('p', {}, message),
        retry,
      ),
    );
  }

  private renderHeader(title: string): HTMLElement {
    const button = (label: string, text: string, action: () => Promise<void>, cls: string) => {
      const el = h(
        'button',
        { type: 'button', class: `calendar__nav ${cls}`, 'aria-label': label },
        text,
      );
      el.addEventListener('click', () => void action());
      return el;
    };
    return h(
      'header',
      { class: 'calendar__header' },
      button('Previous month', '‹', () => this.previous(), 'calendar__nav--prev'),
      h('h1', { class: 'calendar__title', 'aria-live': 'polite' }, title),
      button('Go to today', 'Today', () => this.today(), 'calendar__nav--today'),
      button('Next month', '›', () => this.next(), 'calendar__nav--next'),
    );
  }

  private renderGrid(view: MonthView): HTMLElement {
    const headers = this.deps.formatter
      .weekdays(this.deps.weekStartsOn)
      .map((wd) => h('th', { scope: 'col', abbr: wd.long }, wd.short));

    return h(
      'table',
      { class: 'calendar__grid', role: 'grid' },
      h('thead', {}, h('tr', {}, ...headers)),
      h(
        'tbody',
        {},
        ...view.weeks.map((week) => h('tr', {}, ...week.map((cell) => this.renderDay(cell)))),
      ),
    );
  }

  private renderDay(cell: DayCell): HTMLElement {
    const classes = [
      'calendar__day',
      cell.isCurrentMonth ? '' : 'calendar__day--outside',
      cell.isToday ? 'calendar__day--today' : '',
      cell.events.length > 0 ? 'calendar__day--has-events' : '',
    ].filter(Boolean);

    return h(
      'td',
      {
        class: classes.join(' '),
        'data-date': toIsoString(cell.date),
        'aria-current': cell.isToday ? 'date' : undefined,
      },
      h(
        'time',
        {
          class: 'calendar__date',
          datetime: toIsoString(cell.date),
          'aria-label': this.deps.formatter.date(cell.date),
        },
        String(cell.date.day),
      ),
      cell.events.length > 0 &&
        h(
          'ul',
          { class: 'calendar__events' },
          ...cell.events.map((e) => h('li', {}, this.renderEvent(e))),
        ),
    );
  }

  private renderEvent(event: CalendarEvent): HTMLElement {
    const time = event.startTime ? this.deps.formatter.time(event.startTime) : undefined;
    const title = event.info?.fullTitle ?? (event.title || UNTITLED);
    const label = time ? `${time} ${title}` : title;
    return h(
      'a',
      {
        class: `calendar__event${event.endDate ? ' calendar__event--multi-day' : ''}${time ? ' calendar__event--timed' : ''}`,
        href: event.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: event.notes ? `${label}\n${event.notes}` : label,
        'data-event-id': event.id,
      },
      time ? h('span', { class: 'calendar__event-time' }, time) : null,
      title,
    );
  }
}

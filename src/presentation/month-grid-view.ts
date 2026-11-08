import type { DayCell, EventCard, MonthView } from '../application';
import { toIsoString, type PlainDate } from '../domain';
import type { CalendarFormatter } from './calendar-formatter';
import { h } from './dom';
import type { EventText } from './event-text';
import { renderEventTile } from './event-tile';
import type { Messages } from './messages';

/** Tiles per day before "+N więcej". */
export const MAX_TILES_PER_DAY = 2;

export interface MonthGridViewProps {
  readonly view: MonthView;
  readonly weekdays: readonly { short: string; long: string }[];
  readonly formatter: CalendarFormatter;
  readonly text: EventText;
  readonly messages: Messages;
  readonly onOpenEvent: (card: EventCard, trigger: HTMLElement) => void;
  readonly onOpenDay: (date: PlainDate, cards: readonly EventCard[], trigger: HTMLElement) => void;
}

/** Semantic month table; event tiles are buttons that open the details dialog. */
export function renderMonthGrid(props: MonthGridViewProps): HTMLElement {
  const headers = props.weekdays.map((wd, i) =>
    h('th', { scope: 'col', abbr: wd.long, class: i >= 5 ? 'is-weekend' : undefined }, wd.short),
  );
  return h(
    'div',
    { class: 'cal-grid-card' },
    h(
      'table',
      { class: 'calendar__grid cal-grid' },
      h('thead', {}, h('tr', {}, ...headers)),
      h(
        'tbody',
        {},
        ...props.view.weeks.map((week) =>
          h(
            'tr',
            { class: week.isCompact ? 'cal-week cal-week--compact' : 'cal-week' },
            ...week.days.map((cell) => renderDay(cell, props)),
          ),
        ),
      ),
    ),
  );
}

function renderDay(cell: DayCell, props: MonthGridViewProps): HTMLElement {
  const { formatter, messages: m } = props;
  const classes = [
    'cal-day',
    cell.isCurrentMonth ? '' : 'cal-day--outside',
    cell.isToday ? 'cal-day--today' : '',
    cell.isPast ? 'cal-day--past' : '',
    cell.isWeekend ? 'cal-day--weekend' : '',
    cell.events.length > 0 ? 'cal-day--has-events' : '',
  ].filter(Boolean);
  const iso = toIsoString(cell.date);
  const dayNumber = String(cell.date.day);
  const openDay = (trigger: HTMLElement) => {
    props.onOpenDay(cell.date, cell.events, trigger);
  };

  let number: HTMLElement;
  if (cell.events.length > 0) {
    number = h(
      'button',
      {
        type: 'button',
        class: 'cal-day__num',
        'aria-label': m.dayLabel(formatter.date(cell.date), cell.events.length),
      },
      h('time', { datetime: iso }, dayNumber),
    );
    number.addEventListener('click', () => {
      openDay(number);
    });
  } else {
    number = h(
      'span',
      { class: 'cal-day__num' },
      h('time', { datetime: iso, 'aria-label': formatter.date(cell.date) }, dayNumber),
    );
  }

  const shown = cell.events.slice(0, MAX_TILES_PER_DAY);
  const hidden = cell.events.length - shown.length;
  const more =
    hidden > 0 ? h('button', { type: 'button', class: 'cal-day__more' }, m.more(hidden)) : null;
  more?.addEventListener('click', () => {
    openDay(more);
  });

  return h(
    'td',
    {
      class: classes.join(' '),
      'data-date': iso,
      'aria-current': cell.isToday ? 'date' : undefined,
    },
    h(
      'div',
      { class: 'cal-day__head' },
      number,
      cell.isToday ? h('span', { class: 'cal-day__today', 'aria-hidden': 'true' }, m.today) : null,
    ),
    shown.length > 0 &&
      h(
        'ul',
        { class: 'cal-day__events' },
        ...shown.map((card) =>
          h('li', {}, ...renderEventTile(card, cell.date, props.text, props.onOpenEvent)),
        ),
      ),
    more,
  );
}

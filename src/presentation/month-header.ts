import { h } from './dom';
import { icon } from './icons';
import type { Messages } from './messages';

export interface MonthHeaderProps {
  readonly monthName: string;
  readonly year: string;
  /** Label for the month (e.g. "listopad 2026"), used by assistive technology. */
  readonly countLabel?: string;
  readonly messages: Messages;
  readonly onPrevious: () => void;
  readonly onToday: () => void;
  readonly onNext: () => void;
  /** Filter chips, rendered under a divider. */
  readonly filter?: HTMLElement;
}

/** Card with kicker, month title, event count and the Poprzedni / Dziś / Następny group. */
export function renderMonthHeader(props: MonthHeaderProps): HTMLElement {
  const { messages: m } = props;
  const button = (
    cls: string,
    label: string | undefined,
    content: Node | string,
    onClick: () => void,
  ) => {
    const el = h('button', { type: 'button', class: cls, 'aria-label': label }, content);
    el.addEventListener('click', onClick);
    return el;
  };
  return h(
    'header',
    { class: 'cal-bar' },
    h(
      'div',
      { class: 'cal-bar__top' },
      h(
        'div',
        { class: 'cal-bar__titles' },
        h('span', { class: 'cal-bar__kicker' }, m.kicker),
        h(
          'h1',
          { class: 'calendar__title cal-bar__title', tabindex: '-1', 'aria-live': 'polite' },
          `${props.monthName} `,
          h('span', { class: 'cal-bar__year' }, props.year),
        ),
      ),
      h(
        'div',
        { class: 'cal-bar__actions' },
        props.countLabel ? h('span', { class: 'cal-bar__count' }, props.countLabel) : null,
        h(
          'div',
          { class: 'cal-nav', role: 'group', 'aria-label': m.monthNav },
          button(
            'cal-nav__arrow calendar__nav--prev',
            m.previousMonth,
            icon('chevron-left'),
            props.onPrevious,
          ),
          button('cal-nav__today calendar__nav--today', undefined, m.today, props.onToday),
          button(
            'cal-nav__arrow calendar__nav--next',
            m.nextMonth,
            icon('chevron-right'),
            props.onNext,
          ),
        ),
      ),
    ),
    props.filter ? h('div', { class: 'cal-bar__divider', 'aria-hidden': 'true' }) : null,
    props.filter,
  );
}

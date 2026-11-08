import type { EventCard, EventAction } from '../application';
import type { EventLinks, PlainDate } from '../domain';
import type { CalendarFormatter } from './calendar-formatter';
import { h } from './dom';
import type { EventText } from './event-text';
import { renderLogo, themeStyle } from './event-tile';
import { icon, type IconName } from './icons';
import type { Messages } from './messages';

export interface EventDialogDeps {
  /** Where the `<dialog>` lives; outside the grid root so re-renders keep it open. */
  readonly host: HTMLElement;
  readonly formatter: CalendarFormatter;
  readonly text: EventText;
  readonly messages: Messages;
  readonly links: EventLinks;
  /** Prev/next inside a single-event dialog. */
  readonly onNavigate: (direction: 1 | -1) => void;
  /** Where focus goes when the element that opened the dialog is gone. */
  readonly fallbackFocus: () => HTMLElement | null;
  /** After the dialog became visible. */
  readonly onShown?: () => void;
  /** After it closed; `eventId` is the single event it showed (not set for a day list). */
  readonly onClosed?: (eventId: string | undefined) => void;
}

export interface Neighbours {
  readonly previous?: EventCard;
  readonly next?: EventCard;
}

/** Bottom-sheet drag distance (px) that closes the dialog on touch screens. */
const DRAG_CLOSE_PX = 90;
let nextId = 0;

/**
 * Event details in a native modal `<dialog>` (focus trap, Esc, inert page).
 * Desktop: centred card. Narrow screens: bottom sheet that can be dragged down.
 */
export class EventDialog {
  readonly element: HTMLDialogElement;
  private readonly scroller: HTMLElement;
  private trigger: HTMLElement | null = null;
  private current: EventCard | undefined;
  private navButtons: { previous: HTMLButtonElement; next: HTMLButtonElement } | undefined;
  private positionLabel: HTMLElement | undefined;

  constructor(private readonly deps: EventDialogDeps) {
    const m = deps.messages;
    const close = h(
      'button',
      { type: 'button', class: 'cal-dialog__close', 'aria-label': m.close },
      icon('close'),
    );
    close.addEventListener('click', () => {
      this.close();
    });
    this.scroller = h('div', { class: 'cal-dialog__scroll' });
    this.element = h('dialog', { class: 'cal-dialog', tabindex: '-1' }, close, this.scroller);
    // A click on the dialog element itself (not its content) is a click on the backdrop.
    this.element.addEventListener('click', (event) => {
      if (event.target === this.element) this.close();
    });
    this.element.addEventListener('close', () => {
      this.onClosed();
    });
    deps.host.append(this.element);
  }

  get isOpen(): boolean {
    return this.element.open;
  }

  /** The event shown in single-event mode. */
  get event(): EventCard | undefined {
    return this.current;
  }

  openEvent(
    card: EventCard,
    trigger: HTMLElement | null,
    position?: { index: number; total: number },
  ): void {
    this.current = card;
    const nav = this.renderNav(position);
    this.render([this.renderArticle(card, nav)], this.deps.text.title(card), trigger);
  }

  openDay(date: PlainDate, cards: readonly EventCard[], trigger: HTMLElement | null): void {
    this.current = undefined;
    this.navButtons = undefined;
    this.positionLabel = undefined;
    const label = this.deps.messages.eventDetails(this.deps.formatter.date(date));
    this.render(
      cards.map((card) => this.renderArticle(card)),
      label,
      trigger,
    );
  }

  /** "n / N" within the event's own month; may arrive after opening (another month loads). */
  setPosition(card: EventCard, position: { index: number; total: number } | undefined): void {
    if (card !== this.current || !this.positionLabel) return;
    this.positionLabel.textContent = position
      ? `${String(position.index + 1)} / ${String(position.total)}`
      : '';
  }

  /** Enables prev/next once the neighbours are known (they load asynchronously). */
  setNeighbours(card: EventCard, neighbours: Neighbours): void {
    if (card !== this.current || !this.navButtons) return;
    const m = this.deps.messages;
    const describe = (n: EventCard) =>
      `${this.deps.text.tileTitle(n)}, ${this.deps.formatter.date(n.event.date)}`;
    const set = (
      button: HTMLButtonElement,
      neighbour: EventCard | undefined,
      label: (s: string) => string,
      none: string,
    ) => {
      button.disabled = !neighbour;
      const text = neighbour ? label(describe(neighbour)) : none;
      button.setAttribute('aria-label', text);
      button.title = text;
    };
    set(this.navButtons.previous, neighbours.previous, m.previousEvent, m.noPreviousEvent);
    set(this.navButtons.next, neighbours.next, m.nextEvent, m.noNextEvent);
  }

  close(): void {
    if (this.element.open) this.element.close();
  }

  /**
   * Moves focus into the dialog, e.g. once an embedding layer is shown. The
   * dialog itself takes focus (no ring on a button); Tab reaches its controls.
   */
  focusContent(): void {
    this.element.focus();
  }

  private render(articles: HTMLElement[], label: string, trigger: HTMLElement | null): void {
    if (!this.element.open || trigger) this.trigger = trigger ?? this.trigger;
    this.element.setAttribute('aria-label', label);
    this.element.style.transform = '';
    this.scroller.replaceChildren(...articles);
    this.scroller.scrollTop = 0;
    if (this.element.open) return;
    this.element.showModal();
    this.element.ownerDocument.documentElement.classList.add('cal-modal-open');
    this.deps.onShown?.();
  }

  private onClosed(): void {
    const eventId = this.current?.event.id;
    this.current = undefined;
    this.navButtons = undefined;
    this.positionLabel = undefined;
    this.element.style.transform = '';
    this.element.ownerDocument.documentElement.classList.remove('cal-modal-open');
    const target = this.trigger?.isConnected ? this.trigger : this.deps.fallbackFocus();
    this.trigger = null;
    target?.focus();
    this.deps.onClosed?.(eventId);
  }

  private renderNav(position?: { index: number; total: number }): HTMLElement {
    const m = this.deps.messages;
    const button = (direction: 1 | -1) => {
      const el = h(
        'button',
        {
          type: 'button',
          class: 'cal-evnav__btn',
          disabled: true,
          'aria-label': direction < 0 ? m.noPreviousEvent : m.noNextEvent,
        },
        icon(direction < 0 ? 'chevron-left' : 'chevron-right', 16),
      );
      el.addEventListener('click', () => {
        this.deps.onNavigate(direction);
      });
      return el;
    };
    const previous = button(-1);
    const next = button(1);
    this.navButtons = { previous, next };
    this.positionLabel = h(
      'span',
      { class: 'cal-evnav__pos', 'aria-live': 'polite' },
      position ? `${String(position.index + 1)} / ${String(position.total)}` : '',
    );
    return h(
      'nav',
      { class: 'cal-evnav', 'aria-label': m.otherEvents },
      previous,
      this.positionLabel,
      next,
    );
  }

  private renderArticle(card: EventCard, nav?: HTMLElement): HTMLElement {
    const { messages: m, text } = this.deps;
    const titleId = `cal-ev-title-${String(++nextId)}`;
    const title = text.title(card);

    const banner = h(
      'div',
      { class: 'cal-ev__banner' },
      h('span', { class: 'cal-ev__grab', 'aria-hidden': 'true' }),
      renderLogo(card, card.gameLabel ?? '', 'cal-ev__logo'),
      card.isPast ? h('span', { class: 'cal-ev__badge' }, m.finished) : null,
    );
    this.enableDragToClose(banner);

    const facts: HTMLElement[] = [
      fact(
        'calendar',
        m.when,
        // Keep "18:00–21:00" together when the line wraps on phones.
        [
          `${text.whenDate(card.event)} · `,
          h('span', { class: 'cal-nowrap' }, text.time(card.event)),
        ],
        true,
      ),
      card.location ? fact('pin', m.where, card.location, true) : null,
      card.format ? fact('layers', m.format, text.text(card.format)) : null,
      card.seats ? fact('users', m.seats, text.seats(card.seats)) : null,
    ].filter((f) => f !== null);

    const links = this.renderLinks(card, title);
    const footer = this.renderFooter(card);

    return h(
      'article',
      {
        class: `cal-ev${card.isPast ? ' is-past' : ''}`,
        style: themeStyle(card),
        'aria-labelledby': titleId,
      },
      banner,
      h(
        'div',
        { class: 'cal-ev__body' },
        h(
          'div',
          { class: 'cal-ev__head' },
          card.gameLabel || nav
            ? h(
                'div',
                { class: 'cal-ev__meta' },
                card.gameLabel ? h('span', { class: 'cal-ev__game' }, card.gameLabel) : h('span'),
                nav,
              )
            : null,
          h('h2', { class: 'cal-ev__title', id: titleId }, title),
        ),
        h('dl', { class: 'cal-ev__facts' }, ...facts),
        card.notes
          ? h(
              'div',
              { class: 'cal-ev__notes' },
              h('h3', { class: 'cal-ev__notes-title' }, m.notes),
              h('p', {}, card.notes),
            )
          : null,
        links,
      ),
      footer,
    );
  }

  private renderLinks(card: EventCard, title: string): HTMLElement | null {
    const { messages: m, links, text } = this.deps;
    const items: HTMLElement[] = [];
    if (!card.isPast) {
      const details = [
        card.gameLabel,
        card.format ? `${m.format}: ${text.text(card.format)}` : undefined,
        card.price ? `${m.fee}: ${text.price(card.price)}` : undefined,
        card.action?.link.kind === 'link' ? card.action.link.url : undefined,
      ]
        .filter(Boolean)
        .join('\n');
      const url = links.addToCalendarUrl({
        event: card.event,
        title,
        ...(card.location ? { location: card.location } : {}),
        ...(details ? { details } : {}),
      });
      items.push(externalLink('cal-ev__link', url, m.addToCalendar, 'calendar-plus', m));
    }
    if (card.location) {
      items.push(
        externalLink(
          'cal-ev__link',
          links.directionsUrl(card.location),
          m.directions,
          'navigation',
          m,
        ),
      );
    }
    return items.length > 0 ? h('div', { class: 'cal-ev__links' }, ...items) : null;
  }

  private renderFooter(card: EventCard): HTMLElement | null {
    const { messages: m, text } = this.deps;
    if (!card.price && !card.action) return null;
    return h(
      'div',
      { class: 'cal-ev__foot' },
      card.price
        ? h(
            'div',
            { class: 'cal-ev__fee' },
            h('span', { class: 'cal-ev__fee-label' }, m.fee),
            h('span', { class: 'cal-ev__fee-value' }, text.price(card.price)),
          )
        : h('span'),
      card.action ? renderAction(card.action, m) : null,
    );
  }

  /** Bottom sheet: drag the banner down to close (touch, narrow screens only). */
  private enableDragToClose(handle: HTMLElement): void {
    let startY: number | undefined;
    let dy = 0;
    handle.addEventListener(
      'touchstart',
      (event) => {
        const touch = event.touches[0];
        if (
          !touch ||
          this.element.ownerDocument.defaultView?.matchMedia('(min-width: 761px)').matches
        )
          return;
        startY = touch.clientY;
        dy = 0;
        this.element.classList.add('is-dragging');
      },
      { passive: true },
    );
    handle.addEventListener(
      'touchmove',
      (event) => {
        const touch = event.touches[0];
        if (startY === undefined || !touch) return;
        dy = Math.max(0, touch.clientY - startY);
        this.element.style.transform = `translateY(${String(dy)}px)`;
      },
      { passive: true },
    );
    const end = () => {
      if (startY === undefined) return;
      startY = undefined;
      this.element.classList.remove('is-dragging');
      if (dy > DRAG_CLOSE_PX) this.close();
      else this.element.style.transform = '';
    };
    handle.addEventListener('touchend', end);
    handle.addEventListener('touchcancel', end);
  }
}

function fact(
  iconName: IconName,
  label: string,
  value: string | (string | Node)[],
  wide = false,
): HTMLElement {
  return h(
    'div',
    { class: `cal-fact${wide ? ' cal-fact--wide' : ''}` },
    h('span', { class: 'cal-fact__icon', 'aria-hidden': 'true' }, icon(iconName, 20, 2)),
    h(
      'div',
      { class: 'cal-fact__text' },
      h('dt', {}, label),
      h('dd', {}, ...(typeof value === 'string' ? [value] : value)),
    ),
  );
}

/** Real anchors (not window.open): allowed by popup blockers and iframe sandboxes. */
function externalLink(
  cls: string,
  href: string,
  label: string,
  iconName: IconName,
  m: Messages,
): HTMLElement {
  return h(
    'a',
    { class: cls, href, target: '_blank', rel: 'noopener noreferrer' },
    icon(iconName, 15, 2),
    label,
    h('span', { class: 'visually-hidden' }, ` ${m.opensInNewTab}`),
  );
}

function renderAction(action: EventAction, m: Messages): HTMLElement {
  const register = action.kind === 'register';
  const cls = `cal-cta${register ? '' : ' cal-cta--secondary'}`;
  if (action.link.kind === 'pending') {
    return h(
      'span',
      { class: `${cls} cal-cta--pending`, 'aria-disabled': 'true' },
      register ? m.registerSoon : m.resultsSoon,
    );
  }
  return h(
    'a',
    { class: cls, href: action.link.url, target: '_blank', rel: 'noopener noreferrer' },
    register ? m.register : m.results,
    icon('external', 16),
    h('span', { class: 'visually-hidden' }, ` ${m.opensInNewTab}`),
  );
}

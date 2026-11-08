import type { EventCard } from '../application';
import type { PlainDate } from '../domain';
import { h } from './dom';
import type { EventText } from './event-text';
import { themeOf } from './game-theme';
import { genericLogo, icon } from './icons';

/** Logo for tiles and the dialog banner: the game's image or the inline generic logo. */
export function renderLogo(card: EventCard, alt: string, cls: string): Element {
  const { logoUrl } = themeOf(card.gameId);
  return logoUrl
    ? h('img', { class: cls, src: logoUrl, alt, decoding: 'async', loading: 'lazy' })
    : genericLogo(alt);
}

export function themeStyle(card: EventCard): string {
  const t = themeOf(card.gameId);
  return `--game-color: ${t.color}; --game-tint: ${t.tint}; --game-dot: ${t.dot}; --logo-bg: ${t.logoBg}`;
}

/**
 * One event in a day cell: the desktop tile (logo, short title, time, short
 * format) and the mobile chip (dot + start time). CSS shows one of them.
 */
export function renderEventTile(
  card: EventCard,
  day: PlainDate,
  text: EventText,
  onOpen: (card: EventCard, trigger: HTMLElement) => void,
): HTMLElement[] {
  const label = text.tileLabel(card, day);
  const common = {
    type: 'button',
    'aria-label': label,
    'data-event-id': card.event.id,
    style: themeStyle(card),
  } as const;
  const past = card.isPast ? ' is-past' : '';

  const tile = h(
    'button',
    { ...common, class: `cal-tile${past}` },
    h('span', { class: 'cal-tile__logo' }, renderLogo(card, '', 'cal-tile__img')),
    h(
      'span',
      { class: 'cal-tile__body' },
      h(
        'span',
        { class: 'cal-tile__top' },
        h('span', { class: 'cal-tile__title' }, text.tileTitle(card)),
        icon('chevron-right', 14, 2.4),
      ),
      h('span', { class: 'cal-tile__time' }, icon('clock', 12), text.time(card.event, day)),
      card.tileFormat ? h('span', { class: 'cal-tile__format' }, text.text(card.tileFormat)) : null,
    ),
  );
  const chip = h(
    'button',
    { ...common, class: `cal-mchip${past}` },
    h('span', { class: 'cal-mchip__dot', 'aria-hidden': 'true' }),
    h('span', { class: 'cal-mchip__time' }, text.startTime(card.event, day)),
  );
  for (const el of [tile, chip]) {
    el.addEventListener('click', () => {
      onOpen(card, el);
    });
  }
  return [tile, chip];
}

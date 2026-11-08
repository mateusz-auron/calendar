import type { FilterCounts } from '../application';
import { GAMES, type GameFilter } from '../domain';
import { h } from './dom';
import { GENERIC_THEME, themeOf } from './game-theme';
import type { Messages } from './messages';

export interface GameFilterProps {
  readonly active: GameFilter;
  readonly counts: FilterCounts;
  readonly messages: Messages;
  readonly onPick: (filter: GameFilter) => void;
}

/**
 * Toggle chips: "Wszystkie gry", one per catalogue game (shown even with 0
 * events, as in the design) and "Inne" only when the month has such events.
 */
export function renderGameFilter({
  active,
  counts,
  messages: m,
  onPick,
}: GameFilterProps): HTMLElement {
  const chips: {
    id: GameFilter;
    long: string;
    short: string;
    count: number;
    dot?: string;
    color?: string;
    tint?: string;
  }[] = [
    { id: 'all', long: m.allGames, short: m.allGamesShort, count: counts.all },
    ...GAMES.map((game) => {
      const theme = themeOf(game.id);
      return {
        id: game.id,
        long: game.name,
        short: game.shortName,
        count: counts.games[game.id],
        dot: theme.dot,
        color: theme.color,
        tint: theme.tint,
      };
    }),
  ];
  if (counts.other > 0 || active === 'other') {
    chips.push({
      id: 'other',
      long: m.otherGames,
      short: m.otherGames,
      count: counts.other,
      dot: GENERIC_THEME.dot,
      color: GENERIC_THEME.color,
      tint: GENERIC_THEME.tint,
    });
  }

  return h(
    'div',
    { class: 'cal-chips', role: 'group', 'aria-label': m.gameFilter },
    ...chips.map((chip) => {
      const style = chip.color
        ? `--chip-color: ${chip.color}; --chip-tint: ${chip.tint ?? ''}; --chip-dot: ${chip.dot ?? ''}`
        : undefined;
      const el = h(
        'button',
        {
          type: 'button',
          class: `cal-chip${chip.id === 'all' ? ' cal-chip--all' : ''}`,
          'aria-pressed': chip.id === active ? 'true' : 'false',
          'data-filter': chip.id,
          style,
        },
        chip.dot ? h('span', { class: 'cal-chip__dot', 'aria-hidden': 'true' }) : null,
        h('span', { class: 'cal-chip__long' }, chip.long),
        h('span', { class: 'cal-chip__short', 'aria-hidden': 'true' }, chip.short),
        h('span', { class: 'cal-chip__count' }, String(chip.count)),
      );
      el.addEventListener('click', () => {
        onPick(chip.id);
      });
      return el;
    }),
  );
}

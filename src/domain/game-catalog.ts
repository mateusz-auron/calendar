import { foldText } from './text';

/** Games with their own logo and colours. Adding one: catalogue entry + theme + logo. */
export type GameId = 'lorcana' | 'riftbound' | 'onepiece' | 'pokemon';

export interface Game {
  readonly id: GameId;
  readonly name: string;
  readonly shortName: string;
  /** Lower-case, diacritic-free names an organiser may type. */
  readonly aliases: readonly string[];
}

export const GAMES: readonly Game[] = [
  {
    id: 'lorcana',
    name: 'Lorcana TCG',
    shortName: 'Lorcana',
    aliases: ['lorcana', 'disney lorcana'],
  },
  { id: 'riftbound', name: 'Riftbound TCG', shortName: 'Riftbound', aliases: ['riftbound'] },
  {
    id: 'onepiece',
    name: 'One Piece TCG',
    shortName: 'One Piece',
    aliases: ['one piece', 'onepiece', 'optcg'],
  },
  { id: 'pokemon', name: 'Pokémon TCG', shortName: 'Pokémon', aliases: ['pokemon', 'ptcg'] },
];

export const GAME_IDS: readonly GameId[] = GAMES.map((g) => g.id);

export function gameById(id: GameId): Game {
  const game = GAMES.find((g) => g.id === id);
  if (!game) throw new RangeError(`Unknown game: ${id}`);
  return game;
}

export function isGameId(value: string): value is GameId {
  return (GAME_IDS as readonly string[]).includes(value);
}

/** Words only, single spaces: `"Pokémon TCG (Standard)"` → `"pokemon tcg standard"`. */
function words(text: string): string {
  return foldText(text)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Finds the game a free-text value names. A value matches when it equals an
 * alias or starts with one followed by another word, so `One Piece Card Game`
 * and `Pokemon TCG (Standard)` both match.
 */
export function findGame(text: string): Game | undefined {
  const value = words(text);
  if (!value) return undefined;
  return GAMES.find((game) =>
    game.aliases.some((alias) => value === alias || value.startsWith(`${alias} `)),
  );
}

/** Which events the calendar shows: all, one game, or everything outside the catalogue. */
export type GameFilter = 'all' | GameId | 'other';

export function parseGameFilter(value: string | null | undefined): GameFilter {
  const text = value?.trim().toLowerCase() ?? '';
  return text === 'other' || isGameId(text) ? text : 'all';
}

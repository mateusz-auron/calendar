import type { GameId } from '../domain';
import lorcanaLogo from './assets/games/lorcana.webp';
import onepieceLogo from './assets/games/onepiece.webp';
import pokemonLogo from './assets/games/pokemon.webp';
import riftboundLogo from './assets/games/riftbound.webp';

export interface GameTheme {
  /** Text colour on `tint` (meets 4.5:1). */
  readonly color: string;
  readonly tint: string;
  /** Dot colour for chips and the mobile grid. */
  readonly dot: string;
  /** Background behind the logo. */
  readonly logoBg: string;
  /** Logo URL; `undefined` ⇒ the inline generic logo. */
  readonly logoUrl?: string;
}

export const GAME_THEMES: Readonly<Record<GameId, GameTheme>> = {
  lorcana: {
    color: '#5B3FB4',
    tint: '#EEE9FA',
    dot: '#7C5CE0',
    logoBg: '#F6F3FD',
    logoUrl: lorcanaLogo,
  },
  riftbound: {
    color: '#9A4A06',
    tint: '#FFF0DC',
    dot: '#F08000',
    logoBg: '#003A51',
    logoUrl: riftboundLogo,
  },
  onepiece: {
    color: '#B5212D',
    tint: '#FCE8EA',
    dot: '#E0313F',
    logoBg: '#FCE8EA',
    logoUrl: onepieceLogo,
  },
  pokemon: {
    color: '#1D4ED8',
    tint: '#E3ECFD',
    dot: '#3B82F6',
    logoBg: '#E3ECFD',
    logoUrl: pokemonLogo,
  },
};

export const GENERIC_THEME: GameTheme = {
  color: '#3B414C',
  tint: '#F1F2F5',
  dot: '#9AA0AA',
  logoBg: '#F6F7F9',
};

export function themeOf(gameId: GameId | undefined): GameTheme {
  return gameId ? GAME_THEMES[gameId] : GENERIC_THEME;
}

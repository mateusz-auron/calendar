import { describe, expect, it } from 'vitest';
import { GAME_IDS } from '../domain';
import { GAME_THEMES, GENERIC_THEME, themeOf } from './game-theme';

describe('game themes', () => {
  it('has a theme and a logo for every catalogue game', () => {
    for (const id of GAME_IDS) {
      expect(GAME_THEMES[id].logoUrl).toBeTruthy();
    }
    expect(themeOf(undefined)).toBe(GENERIC_THEME);
  });
});

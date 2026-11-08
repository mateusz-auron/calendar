import { describe, expect, it } from 'vitest';
import { findGame, gameById, GAME_IDS, isGameId } from './game-catalog';

describe('findGame', () => {
  it.each([
    ['Pokemon', 'pokemon'],
    ['POKÉMON', 'pokemon'],
    ['Pokémon TCG (Standard)', 'pokemon'],
    ['ptcg', 'pokemon'],
    ['One Piece Card Game', 'onepiece'],
    ['onepiece', 'onepiece'],
    ['OPTCG', 'onepiece'],
    ['Disney Lorcana', 'lorcana'],
    ['lorcana', 'lorcana'],
    ['Riftbound TCG', 'riftbound'],
  ])('%s → %s', (input, id) => {
    expect(findGame(input)?.id).toBe(id);
  });

  it.each(['', '   ', 'Magic', 'op', 'Pokemonowy', 'Super Pokemon'])('%j → none', (input) => {
    expect(findGame(input)).toBeUndefined();
  });
});

describe('game catalogue', () => {
  it('looks games up by id', () => {
    expect(gameById('pokemon').shortName).toBe('Pokémon');
    expect(isGameId('lorcana')).toBe(true);
    expect(isGameId('magic')).toBe(false);
    expect(GAME_IDS).toHaveLength(4);
  });
});

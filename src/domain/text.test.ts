import { describe, expect, it } from 'vitest';
import { foldText } from './text';

describe('foldText', () => {
  it('lower-cases and strips Polish diacritics, including ł', () => {
    expect(foldText('Pełny Tytuł ŻÓŁĆ ąę Pokémon')).toBe('pelny tytul zolc ae pokemon');
  });
});

import { describe, expect, it } from 'vitest';
import { EN, messagesFor, PL, plural } from './messages';

describe('plural', () => {
  it.each([
    [1, 'miejsce'],
    [2, 'miejsca'],
    [4, 'miejsca'],
    [5, 'miejsc'],
    [12, 'miejsc'],
    [14, 'miejsc'],
    [21, 'miejsc'],
    [22, 'miejsca'],
    [25, 'miejsc'],
    [112, 'miejsc'],
    [0, 'miejsc'],
  ])('%i → %s', (n, word) => {
    expect(plural(n, 'miejsce', 'miejsca', 'miejsc')).toBe(word);
  });
});

describe('messages', () => {
  it('uses Polish unless the locale is English', () => {
    expect(messagesFor('pl-PL')).toBe(PL);
    expect(messagesFor('de-DE')).toBe(PL);
    expect(messagesFor('en-GB')).toBe(EN);
    expect(PL.eventsInMonth(0)).toBe('Brak wydarzeń w tym miesiącu');
    expect(PL.eventsInMonth(22)).toBe('22 wydarzenia w tym miesiącu');
    expect(PL.seatCount(12)).toBe('12 miejsc');
  });
});

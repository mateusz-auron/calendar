import { describe, expect, it } from 'vitest';
import { plainDate, type CalendarEvent, type EventInfo } from '../domain';
import { buildEventCard, matchesFilter, shortFormatOf } from './event-card';

const TODAY = plainDate(2026, 11, 7);
const NOW = { date: TODAY, time: { hour: 12, minute: 0 } };
const at = (hour: number, minute = 0) => ({ date: TODAY, time: { hour, minute } });

const event = (info?: EventInfo, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e',
  title: 'Calendar title',
  date: plainDate(2026, 11, 14),
  url: 'https://calendar.example/e',
  ...(info ? { info } : {}),
  ...extra,
});

const card = (info?: EventInfo, extra: Partial<CalendarEvent> = {}) =>
  buildEventCard(event(info, extra), NOW, { seats: 12 });

describe('buildEventCard – game events', () => {
  it('applies every default when only the game is given', () => {
    expect(card({ game: { kind: 'known', id: 'pokemon' } })).toEqual({
      event: event({ game: { kind: 'known', id: 'pokemon' } }),
      variant: 'game',
      gameId: 'pokemon',
      gameLabel: 'Pokémon TCG',
      tileTitle: 'Pokémon',
      title: 'Calendar title',
      tileFormat: { kind: 'tba' },
      format: { kind: 'tba' },
      price: { kind: 'tba' },
      seats: { kind: 'count', value: 12 },
      isPast: false,
      action: { kind: 'register', link: { kind: 'pending' } },
    });
  });

  it('uses the provided values', () => {
    const result = card({
      game: { kind: 'known', id: 'lorcana' },
      shortTitle: 'Liga',
      fullTitle: 'Liga tygodniowa',
      shortFormat: 'Core',
      fullFormat: 'Core Constructed · 3 rundy',
      price: { kind: 'amount', grosze: 1500 },
      seats: { kind: 'unlimited' },
      registrationUrl: 'https://example.com/r',
      resultsUrl: 'https://example.com/w',
    });
    expect(result).toMatchObject({
      tileTitle: 'Liga',
      title: 'Liga tygodniowa',
      tileFormat: { kind: 'text', text: 'Core' },
      format: { kind: 'text', text: 'Core Constructed · 3 rundy' },
      price: { kind: 'amount', grosze: 1500 },
      seats: { kind: 'unlimited' },
      action: { kind: 'register', link: { kind: 'link', url: 'https://example.com/r' } },
    });
  });

  it('derives the short format from the full format', () => {
    const result = card({ game: { kind: 'known', id: 'pokemon' }, fullFormat: 'Standard, Swiss' });
    expect(result.tileFormat).toEqual({ kind: 'text', text: 'Standard' });
  });

  it('switches to results once the last day has passed', () => {
    const past = { date: plainDate(2026, 11, 6) };
    const info: EventInfo = {
      game: { kind: 'known', id: 'pokemon' },
      registrationUrl: 'https://example.com/r',
      resultsUrl: 'https://example.com/w',
    };
    expect(card(info, past)).toMatchObject({
      isPast: true,
      action: { kind: 'results', link: { kind: 'link', url: 'https://example.com/w' } },
    });
  });

  it('links to the tournament page after the event when there are no results', () => {
    const past = { date: plainDate(2026, 11, 6) };
    const info: EventInfo = {
      game: { kind: 'known', id: 'pokemon' },
      registrationUrl: 'https://example.com/r',
    };
    expect(card(info, past).action).toEqual({
      kind: 'page',
      link: { kind: 'link', url: 'https://example.com/r' },
    });
  });

  it('shows no button after the event without any link (no "results soon")', () => {
    const result = card(
      { game: { kind: 'known', id: 'pokemon' } },
      { date: plainDate(2026, 11, 6) },
    );
    expect(result.isPast).toBe(true);
    expect(result.action).toBeUndefined();
  });

  it('ends at the end time on the same day', () => {
    const today = event(
      { game: { kind: 'known', id: 'pokemon' }, registrationUrl: 'https://example.com/r' },
      { date: TODAY, startTime: { hour: 18, minute: 0 }, endTime: { hour: 21, minute: 0 } },
    );
    const during = buildEventCard(today, at(20, 59), { seats: 12 });
    expect(during).toMatchObject({ isPast: false, action: { kind: 'register' } });
    const after = buildEventCard(today, at(23), { seats: 12 });
    expect(after).toMatchObject({ isPast: true, action: { kind: 'page' } });
    expect(buildEventCard(today, at(21), { seats: 12 }).isPast).toBe(true);
  });

  it('keeps an overnight or midnight end on the next day', () => {
    const overnight = event(undefined, {
      date: TODAY,
      startTime: { hour: 20, minute: 0 },
      endTime: { hour: 2, minute: 0 },
    });
    expect(buildEventCard(overnight, at(23), { seats: 12 }).isPast).toBe(false);
    const midnight = event(undefined, {
      date: TODAY,
      startTime: { hour: 20, minute: 0 },
      endTime: { hour: 0, minute: 0 },
    });
    expect(buildEventCard(midnight, at(23, 59), { seats: 12 }).isPast).toBe(false);
  });

  it('treats all-day and start-only events as running until the end of the day', () => {
    expect(
      buildEventCard(event(undefined, { date: TODAY }), at(23, 59), { seats: 12 }).isPast,
    ).toBe(false);
    const startOnly = event(undefined, { date: TODAY, startTime: { hour: 10, minute: 0 } });
    expect(buildEventCard(startOnly, at(23, 59), { seats: 12 }).isPast).toBe(false);
  });

  it('still offers registration on the event day and during a multi-day event', () => {
    const info: EventInfo = { game: { kind: 'known', id: 'pokemon' } };
    expect(card(info, { date: TODAY }).isPast).toBe(false);
    expect(
      card(info, { date: plainDate(2026, 11, 6), endDate: plainDate(2026, 11, 8) }).action?.kind,
    ).toBe('register');
  });

  it('treats an unknown game as a game event with a generic look', () => {
    expect(card({ game: { kind: 'other', name: 'Magic' } })).toMatchObject({
      variant: 'other-game',
      gameLabel: 'Magic',
      tileTitle: 'Magic',
      price: { kind: 'tba' },
      seats: { kind: 'count', value: 12 },
    });
  });
});

describe('buildEventCard – generic events', () => {
  it('shows only title, date and location when nothing else is given', () => {
    expect(card(undefined, { location: 'Sklep', notes: 'Kawa gratis' })).toEqual({
      event: event(undefined, { location: 'Sklep', notes: 'Kawa gratis' }),
      variant: 'generic',
      tileTitle: 'Calendar title',
      title: 'Calendar title',
      location: 'Sklep',
      notes: 'Kawa gratis',
      isPast: false,
    });
  });

  it('shows provided fields without defaults', () => {
    const result = card({ price: { kind: 'free' }, resultsUrl: 'https://example.com/w' });
    expect(result).toMatchObject({ variant: 'generic', price: { kind: 'free' } });
    expect(result.seats).toBeUndefined();
    expect(result.format).toBeUndefined();
    expect(result.action).toBeUndefined(); // results only matter once ended
  });

  it('falls back to the default location', () => {
    const result = buildEventCard(event(), NOW, { seats: 12, location: 'Sklep, ul. Długa 1' });
    expect(result.location).toBe('Sklep, ul. Długa 1');
  });
});

describe('shortFormatOf', () => {
  it.each([
    ['Standard · Swiss · 4 rundy', 'Standard'],
    ['Standard | Swiss', 'Standard'],
    ['Standard, Swiss', 'Standard'],
    ['Sealed / Draft', 'Sealed'],
    ['Core – 3 rundy', 'Core'],
    ['Core-Constructed', 'Core-Constructed'],
    ['A very long format name that keeps going', 'A very long format name…'],
  ])('%j → %j', (input, expected) => {
    expect(shortFormatOf(input)).toBe(expected);
  });
});

describe('matchesFilter', () => {
  it('groups generic and other-game events under "other"', () => {
    expect(matchesFilter(card(), 'other')).toBe(true);
    expect(matchesFilter(card({ game: { kind: 'other', name: 'Magic' } }), 'other')).toBe(true);
    const pokemon = card({ game: { kind: 'known', id: 'pokemon' } });
    expect(matchesFilter(pokemon, 'pokemon')).toBe(true);
    expect(matchesFilter(pokemon, 'lorcana')).toBe(false);
    expect(matchesFilter(pokemon, 'all')).toBe(true);
  });
});

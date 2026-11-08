import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  parseEventDescription,
  parsePrice,
  parseSeats,
  parseVisible,
  toHttpUrl,
} from './event-description-parser';

const FULL = `game: Pokemon
short_title: League Challenge
full_title: Pokémon TCG League Challenge — listopad 2026
short_format: Standard
full_format: Standard · Swiss · 4 rundy
price: 20
seats: 24
tournament_link: https://example.com/zapisy
results_link:

Przynieś własne koszulki.`;

describe('parseEventDescription', () => {
  it('reads every field of the template and keeps the rest as notes', () => {
    expect(parseEventDescription(FULL)).toEqual({
      info: {
        game: { kind: 'known', id: 'pokemon' },
        shortTitle: 'League Challenge',
        fullTitle: 'Pokémon TCG League Challenge — listopad 2026',
        shortFormat: 'Standard',
        fullFormat: 'Standard · Swiss · 4 rundy',
        price: { kind: 'amount', grosze: 2000 },
        seats: { kind: 'count', value: 24 },
        registrationUrl: 'https://example.com/zapisy',
      },
      notes: 'Przynieś własne koszulki.',
      warnings: [],
    });
  });

  it('returns nothing for an empty description', () => {
    expect(parseEventDescription(undefined)).toEqual({ info: {}, warnings: [] });
    expect(parseEventDescription('  \n ')).toEqual({ info: {}, warnings: [] });
  });

  it('accepts Polish aliases, any casing, diacritics (including ł) and spaced keys', () => {
    const { info } = parseEventDescription(
      [
        'GRA: lorcana',
        'Krótki tytuł: Liga',
        'Pełny tytuł: Liga tygodniowa',
        'krótki-format: Core',
        'Format: Core Constructed',
        'Wpisowe: 15 zł',
        'Liczba miejsc: 16',
        'Zapisy: https://example.com/a',
        'Wyniki: https://example.com/b',
      ].join('\n'),
    );
    expect(info).toEqual({
      game: { kind: 'known', id: 'lorcana' },
      shortTitle: 'Liga',
      fullTitle: 'Liga tygodniowa',
      shortFormat: 'Core',
      fullFormat: 'Core Constructed',
      price: { kind: 'amount', grosze: 1500 },
      seats: { kind: 'count', value: 16 },
      registrationUrl: 'https://example.com/a',
      resultsUrl: 'https://example.com/b',
    });
  });

  it('accepts =, spaced dashes and bullets as separators', () => {
    const { info } = parseEventDescription('- price = 10\n• seats – 8\n* format — Draft');
    expect(info).toEqual({
      price: { kind: 'amount', grosze: 1000 },
      seats: { kind: 'count', value: 8 },
      fullFormat: 'Draft',
    });
  });

  it('keeps URLs with : and = intact', () => {
    const { info } = parseEventDescription('zapisy: https://example.com/t?id=5&x=1#a:b');
    expect(info.registrationUrl).toBe('https://example.com/t?id=5&x=1#a:b');
  });

  it('keeps free text with a colon as a note', () => {
    const result = parseEventDescription('Uwaga: przynieś deck\nLink: https://facebook.com/x');
    expect(result.info).toEqual({});
    expect(result.notes).toBe('Uwaga: przynieś deck\nLink: https://facebook.com/x');
    expect(result.warnings).toEqual([]);
  });

  it('warns about a field-like line without a separator', () => {
    const result = parseEventDescription('zapisy https://example.com\nFormat turnieju to Swiss');
    expect(result.info).toEqual({});
    expect(result.notes).toBe('zapisy https://example.com\nFormat turnieju to Swiss');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('tournament_link');
  });

  it('treats empty values as not provided and lets the first non-empty duplicate win', () => {
    const result = parseEventDescription('price:\nprice: 30\nprice: 40\nseats:');
    expect(result.info).toEqual({ price: { kind: 'amount', grosze: 3000 } });
    expect(result.warnings).toHaveLength(1);
  });

  it('ends fields at a --- line', () => {
    const result = parseEventDescription('price: 5\n---\nseats: 10\nmore text');
    expect(result.info).toEqual({ price: { kind: 'amount', grosze: 500 } });
    expect(result.notes).toBe('seats: 10\nmore text');
  });

  it('keeps one line per field; a wrapped value continues as a note', () => {
    const result = parseEventDescription('format: Standard · Swiss\n4 rundy + top 8');
    expect(result.info.fullFormat).toBe('Standard · Swiss');
    expect(result.notes).toBe('4 rundy + top 8');
  });

  it('collapses blank lines in notes and caps their length', () => {
    expect(parseEventDescription('\n\na\n\n\n\nb\n\n').notes).toBe('a\n\nb');
    const long = parseEventDescription('x'.repeat(5000)).notes ?? '';
    expect(long).toHaveLength(LIMITS.notes);
    expect(long.endsWith('…')).toBe(true);
  });

  it('caps long values', () => {
    const { info } = parseEventDescription(`short_title: ${'a'.repeat(100)}`);
    expect(info.shortTitle).toHaveLength(LIMITS.shortTitle);
  });

  it('reads HTML from the Google Calendar web editor', () => {
    const html =
      '<b>game:</b> One Piece<br>price:&nbsp;15&nbsp;zł<br>' +
      'zapisy: <a href="https://www.google.com/url?q=https://example.com/op&amp;sa=D&amp;source=calendar">Zapisy tutaj</a>' +
      '<br><br><ul><li>Przynieś deck &amp; koszulki</li></ul>';
    expect(parseEventDescription(html)).toEqual({
      info: {
        game: { kind: 'known', id: 'onepiece' },
        price: { kind: 'amount', grosze: 1500 },
        registrationUrl: 'https://example.com/op',
      },
      notes: 'Przynieś deck & koszulki',
      warnings: [],
    });
  });

  it('rejects unsafe links in text and in href', () => {
    const result = parseEventDescription(
      'zapisy: javascript:alert(1)\nwyniki: <a href="javascript:alert(1)">wyniki</a>',
    );
    expect(result.info).toEqual({});
    expect(result.warnings).toHaveLength(2);
  });

  it('keeps markup-like text as text', () => {
    const { info } = parseEventDescription('full_title: &lt;img src=x onerror=alert(1)&gt;');
    expect(info.fullTitle).toBe('<img src=x onerror=alert(1)>');
  });

  describe('game', () => {
    it('uses the first of several games and warns', () => {
      const result = parseEventDescription('game: Pokemon, Lorcana');
      expect(result.info.game).toEqual({ kind: 'known', id: 'pokemon' });
      expect(result.warnings).toHaveLength(1);
    });

    it('keeps an unknown game as "other" with its name', () => {
      const result = parseEventDescription('gra: Magic: the Gathering');
      expect(result.info.game).toEqual({ kind: 'other', name: 'Magic: the Gathering' });
      expect(result.warnings).toHaveLength(1);
    });
  });
});

describe('parsePrice', () => {
  it.each([
    ['20', { kind: 'amount', grosze: 2000 }],
    ['20 zł', { kind: 'amount', grosze: 2000 }],
    ['20zl', { kind: 'amount', grosze: 2000 }],
    ['20 PLN', { kind: 'amount', grosze: 2000 }],
    ['20,50', { kind: 'amount', grosze: 2050 }],
    ['20.5', { kind: 'amount', grosze: 2050 }],
    ['0', { kind: 'free' }],
    ['0,00 zł', { kind: 'free' }],
    ['Bezpłatnie', { kind: 'free' }],
    ['za darmo', { kind: 'free' }],
    ['FREE', { kind: 'free' }],
    ['20–30 zł', { kind: 'text', text: '20–30 zł' }],
    ['15 zł / 10 zł z kartą', { kind: 'text', text: '15 zł / 10 zł z kartą' }],
    ['10 €', { kind: 'text', text: '10 €' }],
  ])('%j', (input, expected) => {
    expect(parsePrice(input)).toEqual(expected);
  });

  it('rejects negative amounts with a warning', () => {
    const warnings: string[] = [];
    expect(parsePrice('-5', warnings)).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });
});

describe('parseSeats', () => {
  it.each([
    ['24', { kind: 'count', value: 24 }],
    ['24 osoby', { kind: 'count', value: 24 }],
    ['24 (zostało 3)', { kind: 'count', value: 24 }],
    ['bez limitu', { kind: 'unlimited' }],
    ['Brak limitu', { kind: 'unlimited' }],
  ])('%j', (input, expected) => {
    const warnings: string[] = [];
    expect(parseSeats(input, warnings)).toEqual(expected);
    expect(warnings).toEqual([]);
  });

  it('uses the upper bound of a range and warns', () => {
    const warnings: string[] = [];
    expect(parseSeats('8-16', warnings)).toEqual({ kind: 'count', value: 16 });
    expect(warnings).toHaveLength(1);
  });

  it.each(['0', 'abc', '1000'])('rejects %j with a warning', (input) => {
    const warnings: string[] = [];
    expect(parseSeats(input, warnings)).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });
});

describe('toHttpUrl', () => {
  it.each([
    ['https://example.com/a', 'https://example.com/a'],
    ['http://example.com', 'http://example.com/'],
    ['www.example.pl/zapisy', 'https://www.example.pl/zapisy'],
    ['example.pl/zapisy?x=1', 'https://example.pl/zapisy?x=1'],
    ['https://www.google.com/url?q=https://example.com/x&sa=D', 'https://example.com/x'],
  ])('%j → %j', (input, expected) => {
    expect(toHttpUrl(input)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    'mailto:a@b.pl',
    'wkrótce',
    'https://exa mple.com',
    'https://www.google.com/url?q=javascript:alert(1)',
    '',
  ])('rejects %j', (input) => {
    expect(toHttpUrl(input)).toBeUndefined();
  });
});

describe('parseVisible', () => {
  it.each(['tak', 'TAK', 'Tak.', 'true', 'yes', '1', 'on', 'widoczne', 'pokaż', 'show'])(
    '%j → visible',
    (input) => {
      expect(parseVisible(input)).toBe(true);
    },
  );

  it.each(['nie', 'NIE', 'Nie!', 'false', 'no', '0', 'off', 'ukryte', 'ukryj', 'hidden'])(
    '%j → hidden',
    (input) => {
      expect(parseVisible(input)).toBe(false);
    },
  );

  it('keeps the event visible for an unknown value and warns', () => {
    const warnings: string[] = [];
    expect(parseVisible('może', warnings)).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });

  it('is read from the description under English and Polish names', () => {
    expect(parseEventDescription('visible: nie').info).toEqual({ visible: false });
    expect(parseEventDescription('Widoczne: false').info).toEqual({ visible: false });
    expect(parseEventDescription('Widoczność = tak').info).toEqual({ visible: true });
    expect(parseEventDescription('pokaż: nie').info).toEqual({ visible: false });
    expect(parseEventDescription('visible:').info).toEqual({});
  });
});

import {
  findGame,
  foldText,
  type EventInfo,
  type GameRef,
  type Price,
  type Seats,
} from '../domain';
import { htmlToLines } from './html-to-text';

/**
 * Reads tournament fields from an event description. The format is meant to be
 * typed by hand in Google Calendar (see docs/event-description.md):
 *
 *   game: Pokemon
 *   price: 20
 *   seats: 24
 *   tournament_link: https://…
 *
 *   Anything else is a note.
 */
export interface ParsedDescription {
  readonly info: EventInfo;
  readonly notes?: string;
  /** Problems an organiser should fix, in Polish (shown in the sync summary). */
  readonly warnings: readonly string[];
}

type FieldKey =
  | 'game'
  | 'short_title'
  | 'full_title'
  | 'short_format'
  | 'full_format'
  | 'price'
  | 'seats'
  | 'tournament_link'
  | 'results_link'
  | 'visible';

const ALIASES: Readonly<Record<FieldKey, readonly string[]>> = {
  game: ['gra'],
  short_title: ['krotki_tytul', 'tytul_krotki'],
  full_title: ['tytul', 'pelny_tytul', 'title'],
  short_format: ['krotki_format'],
  full_format: ['format', 'pelny_format'],
  price: ['wpisowe', 'cena', 'fee'],
  seats: ['miejsca', 'liczba_miejsc', 'ilosc_miejsc'],
  tournament_link: ['zapisy', 'rejestracja', 'registration'],
  results_link: ['wyniki', 'results'],
  visible: ['widoczne', 'widoczny', 'widocznosc', 'pokaz', 'pokazuj', 'visibility', 'show'],
};

const KEYS = new Map<string, FieldKey>(
  (Object.entries(ALIASES) as [FieldKey, readonly string[]][]).flatMap(([key, aliases]) => [
    [key, key] as const,
    ...aliases.map((alias) => [alias, key] as const),
  ]),
);

/** Maximum lengths, so one long value cannot break the layout. */
export const LIMITS = {
  gameName: 30,
  shortTitle: 40,
  fullTitle: 120,
  shortFormat: 24,
  fullFormat: 80,
  priceText: 40,
  notes: 2000,
} as const;

const MAX_SEATS = 999;
const FREE_WORDS = new Set([
  'free',
  'darmowe',
  'darmowy',
  'za darmo',
  'gratis',
  'bezplatnie',
  'bezplatne',
  'bezplatny',
]);
const VISIBLE_WORDS = new Set([
  'tak',
  't',
  'yes',
  'y',
  'true',
  '1',
  'on',
  'widoczne',
  'widoczny',
  'pokaz',
  'pokazuj',
  'show',
  'visible',
  'publiczne',
  'public',
]);
const HIDDEN_WORDS = new Set([
  'nie',
  'n',
  'no',
  'false',
  '0',
  'off',
  'ukryte',
  'ukryty',
  'ukryj',
  'niewidoczne',
  'hide',
  'hidden',
  'prywatne',
  'private',
]);
const UNLIMITED_WORDS = new Set([
  'bez limitu',
  'brak limitu',
  'unlimited',
  'nielimitowane',
  'bez ograniczen',
  '∞',
]);

export function parseEventDescription(description: string | undefined): ParsedDescription {
  if (!description?.trim()) return { info: {}, warnings: [] };

  const values = new Map<FieldKey, { value: string; href?: string }>();
  const notes: string[] = [];
  const warnings: string[] = [];
  let fieldsEnded = false;

  for (const line of htmlToLines(description)) {
    const text = line.text.trim();
    if (/^-{3,}$/.test(text)) {
      fieldsEnded = true;
      continue;
    }
    const field = fieldsEnded ? undefined : splitField(text);
    if (!field) {
      if (!fieldsEnded) warnIfLooksLikeField(text, warnings);
      notes.push(text);
      continue;
    }
    const value = collapse(field.value);
    if (!value && !line.href) continue; // empty template line = not provided
    if (values.has(field.key)) {
      warnings.push(`Pole „${field.key}” podano więcej niż raz; użyto pierwszej wartości.`);
      continue;
    }
    values.set(field.key, { value, ...(line.href ? { href: line.href } : {}) });
  }

  const get = (key: FieldKey) => values.get(key)?.value || undefined;
  const info: Mutable<EventInfo> = {};
  const game = parseGame(get('game'), warnings);
  if (game) info.game = game;
  setText(info, 'shortTitle', get('short_title'), LIMITS.shortTitle);
  setText(info, 'fullTitle', get('full_title'), LIMITS.fullTitle);
  setText(info, 'shortFormat', get('short_format'), LIMITS.shortFormat);
  setText(info, 'fullFormat', get('full_format'), LIMITS.fullFormat);
  const price = parsePrice(get('price'), warnings);
  if (price) info.price = price;
  const seats = parseSeats(get('seats'), warnings);
  if (seats) info.seats = seats;
  const registration = parseLink(values.get('tournament_link'), 'tournament_link', warnings);
  if (registration) info.registrationUrl = registration;
  const results = parseLink(values.get('results_link'), 'results_link', warnings);
  if (results) info.resultsUrl = results;
  const visible = parseVisible(get('visible'), warnings);
  if (visible !== undefined) info.visible = visible;

  const noteText = cleanNotes(notes);
  return { info, ...(noteText ? { notes: noteText } : {}), warnings };
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// ---- Lines ----

/** `key: value`, `key = value` or `key - value`, but only for known keys. */
function splitField(text: string): { key: FieldKey; value: string } | undefined {
  const line = text.replace(/^[-*•–—]+\s+/, '');
  const match = /:|=|\s[-–—]\s/.exec(line);
  if (!match) return undefined;
  const key = KEYS.get(normaliseKey(line.slice(0, match.index)));
  if (!key) return undefined;
  return { key, value: line.slice(match.index + match[0].length) };
}

function normaliseKey(text: string): string {
  return foldText(text)
    .trim()
    .replace(/[\s_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** `zapisy https://…` (no separator) is kept as a note, but the organiser is told. */
function warnIfLooksLikeField(text: string, warnings: string[]): void {
  const match = /^(\S+)\s+(?:https?:|www\.|\d)/i.exec(text.replace(/^[-*•–—]+\s+/, ''));
  const key = match?.[1] ? KEYS.get(normaliseKey(match[1])) : undefined;
  if (key) {
    warnings.push(`Linia „${truncate(text, 60)}” wygląda jak pole „${key}”, ale brakuje „:”.`);
  }
}

function cleanNotes(lines: readonly string[]): string | undefined {
  const text = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text ? truncate(text, LIMITS.notes) : undefined;
}

// ---- Values ----

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function setText(
  info: Mutable<EventInfo>,
  key: 'shortTitle' | 'fullTitle' | 'shortFormat' | 'fullFormat',
  value: string | undefined,
  max: number,
): void {
  if (value) info[key] = truncate(value, max);
}

function parseGame(value: string | undefined, warnings: string[]): GameRef | undefined {
  if (!value) return undefined;
  const parts = value.split(/[,;/&+]|\s(?:i|and|oraz)\s/i).filter((p) => p.trim());
  const matches = parts.map((part) => findGame(part)).filter((g) => g !== undefined);
  const [first] = matches;
  if (first) {
    if (new Set(matches.map((g) => g.id)).size > 1) {
      warnings.push(`W polu „game” podano kilka gier; użyto „${first.shortName}”.`);
    }
    return { kind: 'known', id: first.id };
  }
  warnings.push(`Nieznana gra „${truncate(value, 40)}”; użyto ogólnego logo.`);
  return { kind: 'other', name: truncate(value, LIMITS.gameName) };
}

export function parsePrice(value: string | undefined, warnings: string[] = []): Price | undefined {
  if (!value) return undefined;
  const folded = foldText(value).trim();
  if (FREE_WORDS.has(folded)) return { kind: 'free' };
  const number = /^(-?)\s*(\d{1,5})(?:[.,](\d{1,2}))?\s*(?:zl|pln)?\.?$/.exec(folded);
  if (number) {
    if (number[1]) {
      warnings.push(`Wpisowe „${value}” jest ujemne; pokazano „TBA”.`);
      return undefined;
    }
    const grosze = Number(number[2]) * 100 + Number((number[3] ?? '0').padEnd(2, '0'));
    return grosze === 0 ? { kind: 'free' } : { kind: 'amount', grosze };
  }
  return { kind: 'text', text: truncate(value, LIMITS.priceText) };
}

/** `tak` / `nie`, `true` / `false`, `1` / `0`, … Anything else keeps the event visible. */
export function parseVisible(
  value: string | undefined,
  warnings: string[] = [],
): boolean | undefined {
  if (!value) return undefined;
  const word = foldText(value)
    .trim()
    .replace(/[.!]+$/, '');
  if (VISIBLE_WORDS.has(word)) return true;
  if (HIDDEN_WORDS.has(word)) return false;
  warnings.push(`Nieznana wartość pola „visible”: „${value}”; wydarzenie pozostaje widoczne.`);
  return undefined;
}

export function parseSeats(value: string | undefined, warnings: string[] = []): Seats | undefined {
  if (!value) return undefined;
  if (UNLIMITED_WORDS.has(foldText(value).trim())) return { kind: 'unlimited' };
  const range = /(\d+)\s*[-–—]\s*(\d+)/.exec(value);
  const raw = range?.[2] ?? /\d+/.exec(value)?.[0];
  const count = raw === undefined ? NaN : Number(raw);
  if (range) warnings.push(`Liczba miejsc „${value}” to zakres; użyto ${String(count)}.`);
  if (Number.isInteger(count) && count >= 1 && count <= MAX_SEATS) {
    return { kind: 'count', value: count };
  }
  warnings.push(`Nieprawidłowa liczba miejsc „${value}”; użyto wartości domyślnej.`);
  return undefined;
}

function parseLink(
  field: { value: string; href?: string } | undefined,
  key: FieldKey,
  warnings: string[],
): string | undefined {
  if (!field) return undefined;
  const url = toHttpUrl(field.value) ?? (field.href ? toHttpUrl(field.href) : undefined);
  if (!url) warnings.push(`Pole „${key}” nie zawiera poprawnego linku http(s).`);
  return url;
}

/**
 * Accepts `https://…`, `www.…` and bare `domain.tld/…` (https is added), and
 * unwraps Google's `https://www.google.com/url?q=<target>` redirects.
 * Anything that is not http(s) is rejected.
 */
export function toHttpUrl(value: string): string | undefined {
  const text = value.trim();
  if (!text || /\s/.test(text)) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text)
    ? text
    : /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]|$)/i.test(text)
      ? `https://${text}`
      : undefined;
  if (!withScheme) return undefined;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
  const target = url.searchParams.get('q');
  if (/^(?:www\.)?google\.[a-z.]+$/.test(url.hostname) && url.pathname === '/url' && target) {
    return toHttpUrl(target);
  }
  return url.href;
}

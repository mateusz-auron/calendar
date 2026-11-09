import {
  gameById,
  hasEnded,
  type CalendarEvent,
  type DateTime,
  type GameFilter,
  type GameId,
  type Price,
  type Seats,
} from '../domain';

/** A text field, or "to be announced" when a game event does not provide it. */
export type TextValue = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'tba' };
export type PriceValue = Price | { readonly kind: 'tba' };
/** A usable link, or "coming soon" (shown disabled). */
export type LinkState =
  { readonly kind: 'link'; readonly url: string } | { readonly kind: 'pending' };

/**
 * The footer button:
 * - `register`: until the event ends (a disabled "coming soon" without a link);
 * - `results`: after it ends, when a results link is given;
 * - `page`: after it ends without a results link, opening the tournament page.
 */
export type EventAction =
  | { readonly kind: 'register'; readonly link: LinkState }
  | {
      readonly kind: 'results' | 'page';
      readonly link: { readonly kind: 'link'; readonly url: string };
    };

/**
 * - `game`: a game from the catalogue (own logo, defaults applied).
 * - `other-game`: a game name outside the catalogue (generic logo, defaults applied).
 * - `generic`: no game at all (generic logo; only provided fields are shown).
 */
export type CardVariant = 'game' | 'other-game' | 'generic';

/** Everything the views show for one event, with the organiser defaults applied. */
export interface EventCard {
  readonly event: CalendarEvent;
  readonly variant: CardVariant;
  readonly gameId?: GameId;
  /** Game label in the details view ("Pokémon TCG", or the typed name). */
  readonly gameLabel?: string;
  /** Month-view title; may be empty for an untitled generic event. */
  readonly tileTitle: string;
  /** Details-view title; may be empty for an untitled event. */
  readonly title: string;
  readonly tileFormat?: TextValue;
  readonly format?: TextValue;
  readonly price?: PriceValue;
  readonly seats?: Seats;
  readonly location?: string;
  readonly notes?: string;
  /** The event has ended: its end time has passed (or, without one, its last day). */
  readonly isPast: boolean;
  readonly action?: EventAction;
}

export interface CardDefaults {
  /** Seats shown for game events without a (valid) `seats` value. */
  readonly seats: number;
  /** Location used when the event has none, e.g. the store's address. */
  readonly location?: string;
}

export const CARD_DEFAULTS: CardDefaults = { seats: 12 };

const SHORT_FORMAT_MAX = 24;

export function buildEventCard(
  event: CalendarEvent,
  now: DateTime,
  defaults: CardDefaults = CARD_DEFAULTS,
): EventCard {
  const info = event.info ?? {};
  const game = info.game;
  const variant: CardVariant = !game ? 'generic' : game.kind === 'known' ? 'game' : 'other-game';
  const isGame = variant !== 'generic';
  const isPast = hasEnded(event, now);

  const known = game?.kind === 'known' ? gameById(game.id) : undefined;
  const gameName = known?.shortName ?? (game?.kind === 'other' ? game.name : undefined);
  const fullFormat = info.fullFormat;
  const shortFormat = info.shortFormat ?? (fullFormat ? shortFormatOf(fullFormat) : undefined);
  const location = event.location ?? defaults.location;

  const tba = (text: string | undefined): TextValue | undefined =>
    text ? { kind: 'text', text } : isGame ? { kind: 'tba' } : undefined;
  const linkState = (url: string | undefined): LinkState | undefined =>
    url ? { kind: 'link', url } : isGame ? { kind: 'pending' } : undefined;
  const action = isPast ? pastAction(info) : upcomingAction(linkState(info.registrationUrl));
  const price: PriceValue | undefined = info.price ?? (isGame ? { kind: 'tba' } : undefined);
  const seats: Seats | undefined =
    info.seats ?? (isGame ? { kind: 'count', value: defaults.seats } : undefined);
  const tileFormat = tba(shortFormat);
  const format = tba(fullFormat);

  return {
    event,
    variant,
    ...(known ? { gameId: known.id, gameLabel: known.name } : {}),
    ...(game?.kind === 'other' ? { gameLabel: game.name } : {}),
    tileTitle: info.shortTitle ?? gameName ?? event.title,
    title: info.fullTitle ?? event.title,
    ...(tileFormat ? { tileFormat } : {}),
    ...(format ? { format } : {}),
    ...(price ? { price } : {}),
    ...(seats ? { seats } : {}),
    ...(location ? { location } : {}),
    ...(event.notes ? { notes: event.notes } : {}),
    isPast,
    ...(action ? { action } : {}),
  };
}

function upcomingAction(link: LinkState | undefined): EventAction | undefined {
  return link ? { kind: 'register', link } : undefined;
}

function pastAction(info: {
  readonly resultsUrl?: string;
  readonly registrationUrl?: string;
}): EventAction | undefined {
  if (info.resultsUrl) return { kind: 'results', link: { kind: 'link', url: info.resultsUrl } };
  if (info.registrationUrl) {
    return { kind: 'page', link: { kind: 'link', url: info.registrationUrl } };
  }
  return undefined;
}

/** `Standard · Swiss · 4 rundy` → `Standard` (also splits on `|`, `,`, `/` and spaced dashes). */
export function shortFormatOf(fullFormat: string): string | undefined {
  const [first] = fullFormat.split(/\s*[·|,/]\s*|\s[-–—]\s/);
  const text = first?.trim();
  if (!text) return undefined;
  return text.length > SHORT_FORMAT_MAX ? `${text.slice(0, SHORT_FORMAT_MAX - 1)}…` : text;
}

/** The filter bucket an event belongs to. */
export function filterKeyOf(card: EventCard): Exclude<GameFilter, 'all'> {
  return card.gameId ?? 'other';
}

export function matchesFilter(card: EventCard, filter: GameFilter): boolean {
  return filter === 'all' || filterKeyOf(card) === filter;
}

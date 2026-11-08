import type { GameId } from './game-catalog';

/** A recognised game, or a name the organiser typed that is not in the catalogue. */
export type GameRef =
  | { readonly kind: 'known'; readonly id: GameId }
  | { readonly kind: 'other'; readonly name: string };

/** Entry fee. `amount` is in grosze (1/100 PLN) to avoid floating point. */
export type Price =
  | { readonly kind: 'free' }
  | { readonly kind: 'amount'; readonly grosze: number }
  | { readonly kind: 'text'; readonly text: string };

export type Seats =
  { readonly kind: 'count'; readonly value: number } | { readonly kind: 'unlimited' };

/**
 * Tournament details written by the organiser in the event description.
 * Holds facts only: a field is absent when it was not provided (or invalid).
 * Defaults ("TBA", 12 seats, …) are applied by the application layer.
 */
export interface EventInfo {
  readonly game?: GameRef;
  readonly shortTitle?: string;
  readonly fullTitle?: string;
  readonly shortFormat?: string;
  readonly fullFormat?: string;
  readonly price?: Price;
  readonly seats?: Seats;
  readonly registrationUrl?: string;
  readonly resultsUrl?: string;
  /** `false` hides the event from the calendar (`visible: nie`); absent means visible. */
  readonly visible?: boolean;
}

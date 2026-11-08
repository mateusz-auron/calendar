import type { EventCard, PriceValue, TextValue } from '../application';
import { compareDates, type CalendarEvent, type PlainDate, type Seats } from '../domain';
import type { CalendarFormatter } from './calendar-formatter';
import type { Messages } from './messages';

/** Turns event cards into display strings (copy and formatting live here, not in the model). */
export class EventText {
  constructor(
    private readonly formatter: CalendarFormatter,
    private readonly messages: Messages,
  ) {}

  title(card: EventCard): string {
    return card.title || this.messages.untitled;
  }

  tileTitle(card: EventCard): string {
    return card.tileTitle || this.messages.untitled;
  }

  /** "18:00–21:00", "18:00", or "Cały dzień". On a later day of a multi-day event: "cd.". */
  time(event: CalendarEvent, day?: PlainDate): string {
    if (day && compareDates(day, event.date) > 0) return this.messages.continued;
    if (!event.startTime) return this.messages.allDay;
    const start = this.formatter.time(event.startTime);
    return event.endTime ? `${start}–${this.formatter.time(event.endTime)}` : start;
  }

  /** Start time only (mobile chips). */
  startTime(event: CalendarEvent, day?: PlainDate): string {
    if (day && compareDates(day, event.date) > 0) return this.messages.continued;
    return event.startTime ? this.formatter.time(event.startTime) : this.messages.allDay;
  }

  /** "Sobota, 7 listopada · 11:00–16:00" or "Piątek, 11 grudnia – niedziela, 13 grudnia · …". */
  when(event: CalendarEvent): string {
    return `${this.whenDate(event)} · ${this.time(event)}`;
  }

  /** The date part of {@link when}. */
  whenDate(event: CalendarEvent): string {
    const start = this.formatter.weekdayDate(event.date);
    return event.endDate
      ? `${start} – ${this.formatter.weekdayDate(event.endDate).toLocaleLowerCase()}`
      : start;
  }

  text(value: TextValue): string {
    return value.kind === 'text' ? value.text : this.messages.tba;
  }

  price(value: PriceValue): string {
    switch (value.kind) {
      case 'tba':
        return this.messages.tba;
      case 'free':
        return this.messages.free;
      case 'amount':
        return this.formatter.price(value.grosze);
      case 'text':
        return value.text;
    }
  }

  /** "12" (the label "Liczba miejsc" says what the number is), or "Bez limitu". */
  seats(value: Seats): string {
    return value.kind === 'unlimited' ? this.messages.unlimitedSeats : String(value.value);
  }

  /** Accessible name of a tile: "Pokémon, sobota 7 listopada, 11:00–16:00, Standard — pokaż szczegóły". */
  tileLabel(card: EventCard, day: PlainDate): string {
    const parts = [
      this.tileTitle(card),
      this.formatter.date(day),
      this.time(card.event, day),
      card.tileFormat ? this.text(card.tileFormat) : undefined,
      card.isPast ? this.messages.finished.toLocaleLowerCase() : undefined,
    ].filter(Boolean);
    return `${parts.join(', ')} — ${this.messages.showDetails}`;
  }
}

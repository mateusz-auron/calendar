/** Polish plural forms: 1 miejsce, 2–4 / 22–24 miejsca, 5–21 / 25 / 112–114 miejsc. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const tens = n % 10;
  const hundreds = n % 100;
  return tens >= 2 && tens <= 4 && !(hundreds >= 12 && hundreds <= 14) ? few : many;
}

/** All user-visible copy. Polish is the default; English is used for `?lang=en…`. */
export interface Messages {
  readonly kicker: string;
  readonly eventsInMonth: (n: number) => string;
  readonly monthNav: string;
  readonly previousMonth: string;
  readonly nextMonth: string;
  readonly today: string;
  readonly gameFilter: string;
  readonly allGames: string;
  readonly allGamesShort: string;
  readonly otherGames: string;
  readonly more: (n: number) => string;
  readonly dayLabel: (date: string, n: number) => string;
  readonly showDetails: string;
  readonly footNote: string;
  readonly loading: string;
  readonly loadError: string;
  readonly retry: string;
  readonly emptyFiltered: string;
  readonly showAll: string;
  readonly untitled: string;
  readonly close: string;
  readonly closeDialog: string;
  readonly finished: string;
  readonly otherEvents: string;
  readonly previousEvent: (label: string) => string;
  readonly nextEvent: (label: string) => string;
  readonly noPreviousEvent: string;
  readonly noNextEvent: string;
  readonly eventDetails: (date: string) => string;
  readonly dayEvents: (n: number) => string;
  readonly when: string;
  readonly where: string;
  readonly format: string;
  readonly seats: string;
  readonly fee: string;
  readonly notes: string;
  readonly addToCalendar: string;
  readonly directions: string;
  readonly register: string;
  readonly registerSoon: string;
  readonly results: string;
  readonly resultsSoon: string;
  readonly opensInNewTab: string;
  readonly tba: string;
  readonly free: string;
  readonly unlimitedSeats: string;
  readonly allDay: string;
  readonly continued: string;
}

export const PL: Messages = {
  kicker: 'Kalendarz turniejów',
  eventsInMonth: (n) =>
    n === 0
      ? 'Brak wydarzeń w tym miesiącu'
      : `${String(n)} ${plural(n, 'wydarzenie', 'wydarzenia', 'wydarzeń')} w tym miesiącu`,
  monthNav: 'Nawigacja po miesiącach',
  previousMonth: 'Poprzedni miesiąc',
  nextMonth: 'Następny miesiąc',
  today: 'Dziś',
  gameFilter: 'Filtr gier',
  allGames: 'Wszystkie gry',
  allGamesShort: 'Wszystkie',
  otherGames: 'Inne',
  more: (n) => `+${String(n)} więcej`,
  dayLabel: (date, n) =>
    `${date} — ${String(n)} ${plural(n, 'wydarzenie', 'wydarzenia', 'wydarzeń')}, pokaż szczegóły`,
  showDetails: 'pokaż szczegóły',
  footNote:
    'Kliknij wydarzenie, aby zobaczyć szczegóły. Zapisy odbywają się na dedykowanej platformie turniejowej (otwiera się w nowej karcie).',
  loading: 'Ładowanie wydarzeń…',
  loadError: 'Nie udało się wczytać wydarzeń.',
  retry: 'Spróbuj ponownie',
  emptyFiltered: 'Brak wydarzeń dla wybranej gry w tym miesiącu.',
  showAll: 'Pokaż wszystkie',
  untitled: '(Bez tytułu)',
  close: 'Zamknij',
  closeDialog: 'Zamknij okno',
  finished: 'Zakończony',
  otherEvents: 'Inne wydarzenia',
  previousEvent: (label) => `Poprzednie wydarzenie: ${label}`,
  nextEvent: (label) => `Następne wydarzenie: ${label}`,
  noPreviousEvent: 'Brak poprzedniego wydarzenia',
  noNextEvent: 'Brak następnego wydarzenia',
  eventDetails: (date) => `Szczegóły wydarzeń: ${date}`,
  dayEvents: (n) => `${String(n)} ${plural(n, 'wydarzenie', 'wydarzenia', 'wydarzeń')} tego dnia`,
  when: 'Termin',
  where: 'Miejsce',
  format: 'Format',
  seats: 'Liczba miejsc',
  fee: 'Wpisowe',
  notes: 'Opis',
  addToCalendar: 'Dodaj do kalendarza',
  directions: 'Wyznacz trasę',
  register: 'Zapisz się na turniej',
  registerSoon: 'Zapisy wkrótce',
  results: 'Zobacz wyniki',
  resultsSoon: 'Wyniki wkrótce',
  opensInNewTab: '(otwiera się w nowej karcie)',
  tba: 'TBA',
  free: 'Bezpłatnie',
  unlimitedSeats: 'Bez limitu',
  allDay: 'Cały dzień',
  continued: 'cd.',
};

const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const EN: Messages = {
  kicker: 'Tournament calendar',
  eventsInMonth: (n) =>
    n === 0 ? 'No events this month' : `${String(n)} ${s(n, 'event', 'events')} this month`,
  monthNav: 'Month navigation',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  today: 'Today',
  gameFilter: 'Game filter',
  allGames: 'All games',
  allGamesShort: 'All',
  otherGames: 'Other',
  more: (n) => `+${String(n)} more`,
  dayLabel: (date, n) => `${date} — ${String(n)} ${s(n, 'event', 'events')}, show details`,
  showDetails: 'show details',
  footNote:
    'Select an event to see its details. Registration happens on a tournament platform (opens in a new tab).',
  loading: 'Loading events…',
  loadError: 'Could not load events.',
  retry: 'Retry',
  emptyFiltered: 'No events for the selected game this month.',
  showAll: 'Show all',
  untitled: '(No title)',
  close: 'Close',
  closeDialog: 'Close dialog',
  finished: 'Finished',
  otherEvents: 'Other events',
  previousEvent: (label) => `Previous event: ${label}`,
  nextEvent: (label) => `Next event: ${label}`,
  noPreviousEvent: 'No previous event',
  noNextEvent: 'No next event',
  eventDetails: (date) => `Event details: ${date}`,
  dayEvents: (n) => `${String(n)} ${s(n, 'event', 'events')} on this day`,
  when: 'When',
  where: 'Where',
  format: 'Format',
  seats: 'Seats',
  fee: 'Entry fee',
  notes: 'Details',
  addToCalendar: 'Add to calendar',
  directions: 'Directions',
  register: 'Register',
  registerSoon: 'Registration soon',
  results: 'See results',
  resultsSoon: 'Results soon',
  opensInNewTab: '(opens in a new tab)',
  tba: 'TBA',
  free: 'Free',
  unlimitedSeats: 'Unlimited',
  allDay: 'All day',
  continued: 'cont.',
};

export function messagesFor(locale: string): Messages {
  return locale.toLowerCase().startsWith('en') ? EN : PL;
}

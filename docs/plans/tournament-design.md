# Plan: tournament calendar redesign (V2 "Kalendarz turniejów")

Source design: Claude Design canvas "TCG Event Calendar — LGS embed", artboard
**V2 · Kalendarz turniejów (PL, okno szczegółów)**. The canvas marks it as the lead version.
Its desktop width is 1200 px and its mobile width is 390 px. V1 and V3 are older explorations
and are out of scope.

> **Status:** steps 1–6 are implemented. The dark theme is out of scope (light only, as in
> the design), so the `theme` URL parameter was removed.
>
> Revision 2: this version was checked against the code and the design. Corrections to
> revision 1 are marked **(fix)**, and the full edge-case list is in §8.

## 1. What the design adds compared with today

| Area         | Today                        | V2 design                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header       | `‹ Month Year Today ›`       | Card with the kicker "Kalendarz turniejów", month name in Bricolage Grotesque plus the year in grey, the pill "N wydarzeń w tym miesiącu", and a Poprzedni / Dziś / Następny segmented control.                                                                                                                                                                                                                                                                                                               |
| Filter       | none                         | Game chips "Wszystkie gry" + one per game (colour dot, count badge, `aria-pressed`). On mobile they become a 2-column grid with short labels.                                                                                                                                                                                                                                                                                                                                                                 |
| Grid         | 6×7 table, text links        | Monday first, weekend columns tinted, past day numbers greyed, today shown as a filled badge with a "DZIŚ" label, weeks with no events collapse to a compact row. At most **2 tiles per day** plus "+N więcej".                                                                                                                                                                                                                                                                                               |
| Tile (month) | `<a>` opening the URL        | `<button>` with the game **logo** on a game-coloured background, **short_title**, a clock icon with "18:00–21:00", and a **short_format** pill. Past events are shown at 60 % opacity. On mobile (≤760 px) the tile becomes a coloured chip with a dot and the start time.                                                                                                                                                                                                                                    |
| Details      | none                         | Modal dialog (bottom sheet on mobile, drag down to close). It holds a logo banner (with a "Zakończony" badge for past events), a game label, prev/next event navigation with "n / N", **full_title**, and tiles for Termin, Format (**full_format**), Liczba miejsc (**seats**). Links: "Dodaj do kalendarza" and "Wyznacz trasę". Sticky footer: **Wpisowe** (**price**) plus the CTA "Zapisz się na turniej" (upcoming, links to **tournament_link**) or "Zobacz wyniki" (past, links to **results_link**). |
| Language     | English UI (`en-US` default) | Polish copy throughout, with Polish plurals (miejsce / miejsca / miejsc, wydarzenie / wydarzenia / wydarzeń).                                                                                                                                                                                                                                                                                                                                                                                                 |

Design tokens taken from the artboard (light theme): text `#171A21`, muted `#5B6270`,
secondary `#3B414C`, faint `#9AA0AA`, borders `#E6E8EC` / `#E2E5EA` / `#EEF0F3`,
surfaces `#F6F7F9` / `#F7F8FA` / weekend `#F5F6F8`, CTA `#171A21`. Corner radii are
18 (cards), 14 (detail tiles), 12 (tiles), and 22 (dialog). Fonts are Inter 400–700 and
Bricolage Grotesque 700/800.

Per-game theme (`color`, `tint`, `dot`, `imgBg`):

| Game      | name          | short     | color     | tint      | dot       | imgBg     |
| --------- | ------------- | --------- | --------- | --------- | --------- | --------- |
| lorcana   | Lorcana TCG   | Lorcana   | `#5B3FB4` | `#EEE9FA` | `#7C5CE0` | `#F6F3FD` |
| riftbound | Riftbound TCG | Riftbound | `#9A4A06` | `#FFF0DC` | `#F08000` | `#003A51` |
| onepiece  | One Piece TCG | One Piece | `#B5212D` | `#FCE8EA` | `#E0313F` | `#FCE8EA` |
| pokemon   | Pokémon TCG   | Pokémon   | `#1D4ED8` | `#E3ECFD` | `#3B82F6` | `#E3ECFD` |
| _generic_ | –             | –         | `#3B414C` | `#F1F2F5` | `#9AA0AA` | `#F6F7F9` |

## 2. Data contract: how an organiser fills in a Google Calendar event

### 2.1 Native Google Calendar fields (always read from the event)

| Field                 | Used for                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Title (`summary`)     | Fallback for `full_title`. Also the fallback for `short_title` on generic events.                                     |
| Start / end           | Date, the "18:00–21:00" range, "Dodaj do kalendarza", and past/upcoming state.                                        |
| Location (`location`) | The "Miejsce" row and the "Wyznacz trasę" link. Falls back to `VITE_DEFAULT_LOCATION` (the store address) when empty. |
| Description           | Every other field, one per line (see below).                                                                          |

Prerequisite **(fix)**: the calendar must be shared publicly with **"See all event details"**.
With "See only free/busy", the API and iCal return events without a title, description, or
location. Every event would then be a nameless generic event. `docs/event-description.md`
explains this setting.

### 2.2 Description format

One `key: value` per line. Everything else is free text.

```
game: Pokemon
short_title: League Challenge
full_title: Pokémon TCG League Challenge — listopad 2026
short_format: Standard
full_format: Standard · Swiss · 4 rundy
price: 20
seats: 24
tournament_link: https://play.pokemon.com/...
results_link:

Przynieś własne koszulki. Dowolny tekst pod polami trafi do sekcji „Opis”.
```

How a line is read (the parser is forgiving, so a real person typing in the Google Calendar
description box gets the result they expect):

1. Line endings `\r\n`, `\r` and `\n` are all accepted. Leading bullets (`-`, `*`, `•`, `–`)
   and surrounding whitespace are trimmed.
2. A line is a **field** only when its key part is a **known key or alias**. The key part is
   the text before the first separator: `:`, `=`, or a spaced dash (`-`, `–`, `—`), so
   `wpisowe – 20 zł` works. **(fix)** In all other cases the whole line is a **note**. This
   keeps lines like `Uwaga: przynieś deck` intact, and keeps a URL from being split at the
   `:` in `https:` (`zapisy https://…` has no separator after the key, so it is a note and
   produces a warning).
3. Key normalisation: lower-case; strip diacritics with NFD and **also map `ł→l`** **(fix:
   NFD does not decompose `ł`, so `pełny tytuł` would otherwise not match)**; then turn runs
   of spaces, `-`, and `_` into one `_`.
4. **Polish aliases** are accepted for every key. **(fix)** The bare word `link` is dropped,
   because it is too generic (`Link: facebook…` in a note would become the registration
   link).

   | Key               | Aliases                                    |
   | ----------------- | ------------------------------------------ |
   | `game`            | `gra`                                      |
   | `short_title`     | `krotki_tytul`, `tytul_krotki`             |
   | `full_title`      | `tytul`, `pelny_tytul`, `title`            |
   | `short_format`    | `krotki_format`                            |
   | `full_format`     | `format`, `pelny_format`                   |
   | `price`           | `wpisowe`, `cena`, `fee`                   |
   | `seats`           | `miejsca`, `liczba_miejsc`, `ilosc_miejsc` |
   | `tournament_link` | `zapisy`, `rejestracja`, `registration`    |
   | `results_link`    | `wyniki`, `results`                        |

5. An empty value (`results_link:`) means "not provided". This lets organisers keep the full
   template in every event and fill it in later.
6. If a key appears more than once, the **first non-empty** occurrence wins **(fix: a blank
   template line followed by a filled one used to lose)**. Every later one produces a
   warning.
7. A line containing only `---` (or more dashes) ends the fields: everything after it is
   notes. Notes keep their line breaks (`white-space: pre-line`) and are rendered as text.
8. A value is **one line**. If a long `full_format` wraps onto the next line, that line
   becomes a note. The organiser guide says so.

HTML handling **(fix)**. The Google web editor stores HTML. The existing `stripHtml` is not
enough, so it is replaced by `htmlToLines()`:

- `<br>`, `</p>`, `</div>`, `<li>` and `</li>` become new lines, and other tags are dropped.
- Named entities and **numeric entities** (`&#8211;`, `&#x2013;`) are decoded **once**.
  Today `&amp;lt;` is decoded twice and becomes `<`.
- Links: when a link field's visible text is not a URL (the organiser used "Insert link" with
  custom text such as "Zapisy tutaj"), take the `href` of the `<a>` on that line instead.
  Google wraps hrefs as `https://www.google.com/url?q=<real>&sa=D…`; unwrap `q` and only
  accept it if the result is `http(s)`.
- iCal exports from Google can contain the same HTML in `DESCRIPTION`, so the same function
  runs for both sources (it already sits in the shared `toCalendarEvent()`).

### 2.3 Values, validation, and defaults

The adapter stores only what was actually provided, so the domain keeps facts rather than
defaults. The application layer applies the defaults below, which keeps them in one testable
place. All text values are trimmed and have their whitespace collapsed.

| Field             | Accepted input                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Invalid / missing on a **game event**                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game`            | The normalised value **equals or starts with** a catalogue alias followed by a non-letter, so `Pokemon TCG (Standard)`, `One Piece Card Game` and `Disney Lorcana` all match. Aliases include `pokemon`, `ptcg`, `one piece`, `optcg`, `lorcana`, `riftbound`. **(fix)** The 2-letter `op` is dropped as too ambiguous. If several games are listed, the first match wins and a warning is produced.                                                                           | Missing makes the event **generic** (see 2.4). An unknown name (e.g. `Magic`) is an "other game" event: generic logo and colours, the typed name (capped at 30 characters) as the label, and the defaults below still apply. |
| `short_title`     | text, capped at 40 characters                                                                                                                                                                                                                                                                                                                                                                                                                                                  | The game's short name ("Pokémon"), as the design's tiles show. For "other game" events, the typed game name.                                                                                                                 |
| `full_title`      | text, capped at 120 characters                                                                                                                                                                                                                                                                                                                                                                                                                                                 | The Google event title. If that is empty too: "(Bez tytułu)".                                                                                                                                                                |
| `full_format`     | text, capped at 80 characters                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **"TBA"**                                                                                                                                                                                                                    |
| `short_format`    | text, capped at 24 characters                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **(fix)** The first segment of `full_format` split on `·`, `\|`, `,`, `/` or a spaced dash (organisers will not type `·`), otherwise **"TBA"**.                                                                              |
| `price`           | The whole value must be a number with an optional `zł`/`zl`/`PLN`: `20`, `20 zł`, `20zl`, `20 PLN`, `20,50`, `20.50`. Shown as "20 zł" or "20,50 zł" (`minimumFractionDigits: 0`, **(fix: plain `Intl` currency formatting gives "20,00 zł")**). `0`, `free`, `darmowe`, `bezpłatnie`, `za darmo` → "Bezpłatnie". Anything else (`20–30 zł`, `15 zł / 10 zł z kartą`, `10 €`) is shown **as typed**, capped at 40 characters. A negative number gives a warning and **"TBA"**. | **"TBA"**                                                                                                                                                                                                                    |
| `seats`           | The first integer in the value (`24`, `24 osoby`, `24 (zostało 3)`), between 1 and 999. **(fix)** `bez limitu`, `brak limitu`, `unlimited`, `∞` → "Bez limitu". A range like `8-16` uses the upper bound and produces a warning.                                                                                                                                                                                                                                               | **12** (`0`, `999+`, and text without a number give a warning and 12).                                                                                                                                                       |
| `tournament_link` | `http(s)` URL. `www.…` or a bare `domain.tld/…` gets `https://` added. `javascript:`, `data:`, `mailto:` and garbage are rejected.                                                                                                                                                                                                                                                                                                                                             | Upcoming: the CTA becomes a disabled "Zapisy wkrótce".                                                                                                                                                                       |
| `results_link`    | same as above                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Past: the CTA becomes a disabled "Wyniki wkrótce". On upcoming events results are never shown.                                                                                                                               |

Polish plurals **(fix: tested explicitly)**: 1 miejsce, 2–4 / 22–24 miejsca, 5–21 / 25 /
112–114 miejsc. The same rule applies to "wydarzenie".

### 2.4 Generic events (no `game` line)

These are meant for store closures, open days, release parties, and similar events.

- They use the **generic logo** (a neutral card-stack icon) and neutral colours, with no game
  label. **(fix)** They share the **"Inne"** filter chip with "other game" events. The chip
  appears only when the visible month has such events.
- By default they show only **title, date/time and location** (plus notes).
- Any field that _is_ provided and valid is shown. **No defaults are applied**: no "TBA", no
  "12 miejsc", and no disabled "Zapisy/Wyniki wkrótce" buttons. The footer is hidden entirely
  when there is neither a price nor a link.
- Tile: generic logo, `short_title` (or the event title), and the time. The format pill is
  omitted unless a format was provided.

### 2.5 Organiser-facing deliverables

- `docs/event-description.md`, written in Polish: the public-sharing prerequisite, a
  copy-paste template, a table of keys and aliases, a full game example, a generic example,
  what each default looks like, the one-line-per-field rule, and how links work.
- Parser **warnings** (unknown key-like line, unknown game, invalid link, unparseable seats,
  duplicate key) are returned next to the parsed result. `sync-ical.ts` runs the parser on
  every snapshot event (it can already import `src/infrastructure`) and writes the warnings to
  `$GITHUB_STEP_SUMMARY` as "event date, title, warning". The browser ignores them.
- Recurring events (weekly leagues): every instance inherits the description. To add
  `results_link` to one instance, edit "only this event" in Google Calendar. Both sources
  already handle per-instance overrides (iCal `RECURRENCE-ID`, API `singleEvents=true`).

## 3. Architecture changes (respecting the layer rules)

```
infrastructure: raw-event.ts ── parseEventDescription() ──► domain: CalendarEvent + EventInfo (facts)
application:    buildEventCard(event, today, defaults) ───► EventCard (defaults applied, semantic)
presentation:   CalendarView / EventTile / EventDialog ───► DOM (Polish copy, game theme, logos)
```

The snapshot keeps storing the **raw description**. Parsing happens at read time in
`toCalendarEvent()`, so improving the parser never requires a snapshot format change, and old
snapshots benefit immediately.

### 3.1 Domain (`src/domain/`)

- `calendar-event.ts`: add `endTime?: TimeOfDay`, `location?: string`, `info: EventInfo`
  (required; `{}` when nothing is parsed, and existing test fixtures get `info: {}`), and
  `notes?: string`. `title` and `url` stay. `description` is replaced by `notes`. The tile's
  `title` tooltip goes away, because the dialog shows everything.
- New `event-info.ts`:
  ```ts
  type GameRef = { kind: 'known'; id: GameId } | { kind: 'other'; name: string };
  type Price =
    { kind: 'free' } | { kind: 'amount'; grosze: number } | { kind: 'text'; text: string };
  type Seats = { kind: 'count'; value: number } | { kind: 'unlimited' };
  interface EventInfo {
    game?: GameRef;
    shortTitle?: string;
    fullTitle?: string;
    shortFormat?: string;
    fullFormat?: string;
    price?: Price;
    seats?: Seats;
    registrationUrl?: string;
    resultsUrl?: string;
  }
  ```
- New `game-catalog.ts`: `GameId = 'lorcana' | 'riftbound' | 'onepiece' | 'pokemon'`, with
  `name`, `shortName`, and `aliases` for each, plus `findGame(text)`. This is pure data;
  colours and logos live in presentation. Adding a game later means one catalogue entry, one
  theme entry, and one logo. A unit test checks that every `GameId` has a theme and a logo.
- New port `EventLinks` in `ports.ts`: `addToCalendarUrl(event)` and
  `directionsUrl(location)`. This keeps Google URLs out of components.

### 3.2 Infrastructure (`src/infrastructure/`)

- New `event-description-parser.ts` (pure, the most heavily tested file):
  `parseEventDescription(html): { info: EventInfo; notes?: string; warnings: string[] }`,
  including `htmlToLines()` from §2.2.
- `raw-event.ts`: `RawEvent` gains `location?`. `toCalendarEvent()` calls the parser and
  fills `endTime`. **(fix)** Today `resolve()` subtracts 1 ms from the end instant to find the
  last _day_. The end _time_ must come from the exact instant, so a 20:00–00:00 event shows
  "20:00–00:00" rather than "20:00–23:59". See §8 for events that run past midnight.
- `google-calendar-event-repository.ts`: add `location` to `FIELDS` and map it.
- `event-snapshot.ts` + `scripts/ical/ical-to-snapshot.ts`: write and read the optional
  `location` field (iCal `LOCATION`, unescaped by ical.js). This is an **additive** change,
  so `version: 1` stays. The first scheduled sync after the deploy shows "changed" (the
  fingerprint now includes `location`) and redeploys once, which is expected.
- New `google-event-links.ts` implements `EventLinks`:
  - Add to calendar: `calendar.google.com/calendar/render?action=TEMPLATE&text&dates&details&location&ctz`.
    Timed events use wall-clock `YYYYMMDDTHHMMSS/…` with `ctz=<timeZone>`. All-day events use
    `YYYYMMDD/YYYYMMDD+1` (exclusive end). Multi-day events use the real end date. An event
    without an end time gets start + 1 h. `details` holds the format, the price, and the
    registration link (if valid).
  - Directions: `google.com/maps/dir/?api=1&destination=<encoded location>`. It is hidden
    when there is no location and no `VITE_DEFAULT_LOCATION`.
- `demo-event-repository.ts`: generate realistic tournament events (the design's weekly
  rhythm: Mon Lorcana, Tue Riftbound, Fri One Piece, Sat Pokémon). Each month also gets one
  generic event and one game event with every optional field missing, so the demo exercises
  every default.

### 3.3 Application (`src/application/`)

- New `event-card.ts`: `buildEventCard(event, today, defaults)` → `EventCard`:
  ```ts
  { variant: 'game' | 'other-game' | 'generic'; gameId?: GameId; gameLabel?: string;
    tileTitle: string; title: string; tileFormat?: FieldValue; format?: FieldValue;
    price?: PriceValue; seats?: SeatsValue; location?: string; notes?: string;
    isPast: boolean; isOngoing: boolean;
    registration?: LinkState; results?: LinkState }  // LinkState = {kind:'link',url} | {kind:'pending'}
  ```
  `FieldValue` / `PriceValue` include `{ kind: 'tba' }`, so the copy ("TBA") stays in
  presentation. `CARD_DEFAULTS = { seats: 12 }` can be overridden through `main.ts`
  (`VITE_DEFAULT_SEATS`).
  - `isPast` means the **last day < today**, as in the design. **(fix)** "Today" must come
    from the **calendar's time zone**, not the viewer's. See the clock item in §3.6.
  - Registration is shown when the event is not past (including on its own day). Results are
    shown when it is past.
- `month-grid.ts` **(fix: the existing test asserts 6 weeks; it changes deliberately)**:
  - Drop leading/trailing weeks that contain no day of the month. This gives 4–6 rows; a
    February starting on Monday has 4. The host's iframe height changes between months,
    which the resize message already handles.
  - Add `isCompact` for weeks without (filtered) events.
  - Days outside the month in the first and last row still show their events, but dimmed.
  - Filter: `'all' | GameId | 'other'`.
  - **Counts** for the chips and the "N wydarzeń" pill count events **starting in the
    visible month**, with no filter applied to the chip counts. A multi-day event counts
    once.
  - Each cell exposes `shown` (at most 2) and `hiddenCount`.
- `calendar-service.ts`:
  - `getMonthView(month, filter)`.
  - `findAdjacentEvent(event, direction, filter)` for prev/next in the dialog. **(fix)** It
    searches the current grid range first. If nothing is found, it moves one month at a time,
    **at most 3 months**, then gives up and the button is disabled. Without that limit the API
    source (which has no range bound) would loop through empty months. It queries with the
    same `gridRange()` the grid uses, so results come from `CachingEventRepository` instead of
    triggering extra fetches. Ordering: start date, then start time, then id. All-day events
    sort first.

### 3.4 Presentation (`src/presentation/`)

Split the current 200-line `CalendarView` into focused renderers, all using `h()` and never
`innerHTML`:

- `calendar-view.ts`: state (month, filter, open dialog) and the loading/error flow (the
  contract is unchanged: `show()` never rejects).
  - **(fix)** Today every render runs `root.replaceChildren()`. The dialog therefore lives
    in its own host element **outside** the replaced grid root, so a month change (from
    prev/next) does not destroy an open dialog.
  - The existing `renderToken` guard also covers dialog navigation: a slow fetch for an old
    month must not overwrite a newer one.
  - Filter changes keep the month. Month navigation keeps the filter. Month navigation with
    the header buttons closes the dialog.
  - Empty states: "Brak wydarzeń w tym miesiącu", and with a filter active, "Brak wydarzeń
    dla wybranej gry w tym miesiącu" with a "Pokaż wszystkie" button.
- `month-header.ts`: kicker, title, count pill, nav group (`aria-label` "Poprzedni miesiąc" /
  "Następny miesiąc", "Dziś").
- `game-filter.ts`: chips (`role="group"`, `aria-pressed`). Games with 0 events stay visible
  and clickable, as in the design.
- `month-grid-view.ts`: weekday header and cells, with **semantic table markup**
  (`<table>/<th scope=col abbr>`, `aria-current="date"`). **(fix)** Drop `role="grid"` from
  the table: it promises arrow-key grid navigation that the widget doesn't implement. A plain
  table plus buttons is correct. Cells hold up to 2 `EventTile`s and a "+N więcej" button,
  which opens the day dialog.
- `event-tile.ts`: desktop tile and mobile chip. Both are `<button>` and open the dialog.
  - `aria-label` example: "Pokémon, sobota 7 listopada, 11:00–16:00, Standard — pokaż
    szczegóły". The mobile chip shows only a dot and the start time, so the label carries
    everything.
  - All-day events show "Cały dzień" instead of a time range.
  - Continuation days of a multi-day event show "cd." instead of the time.
- `event-dialog.ts`: native `<dialog>` + `showModal()` (happy-dom supports it, verified).
  This gives a focus trap, Esc, an inert page, and a close button. **(fix)** Focus returns to
  the triggering tile on close. If that tile no longer exists (the month changed), focus goes
  to the month title.
  - Content: the banner, then `<dl>` tiles: Termin (date, time range, or "Cały dzień", or
    "pt 12 – nd 14 grudnia" for multi-day events), Miejsce, Format, Liczba miejsc. Rows that
    don't apply to generic events are omitted. Then notes as text, the extlinks, and the
    sticky footer.
  - CTAs are real `<a target="_blank" rel="noopener noreferrer">`. **(fix)** The design uses
    `rel="noopener"` only; CLAUDE.md requires `noreferrer` too. "Zapisy wkrótce" / "Wyniki
    wkrótce" are `<span aria-disabled="true">`, not links.
  - Day dialog (from "+N więcej" or the day number): the events of that day are stacked, as
    in the design. Prev/next navigates event by event.
  - "n / N": the position within the visible month (filter applied). Hidden when the event
    is outside the visible month.
  - Mobile: bottom sheet. Drag to close (>90 px) on the banner uses a non-passive
    `touchmove` listener, only while dragging. Respect `prefers-reduced-motion`.
- `game-theme.ts`: `GameId | 'generic'` → `{ color, tint, dot, imgBg, logoUrl }`. Logos are
  imported from `src/presentation/assets/games/` so Vite hashes them and they work under
  `base: './'`. Every logo `<img>` gets `width`/`height` attributes (no layout shift) and
  `alt` = the game name (an empty alt in tiles, where the label already names the game).
- `messages.ts`: Polish strings plus `plural(n, one, few, many)`, with an `en` dictionary
  chosen by locale prefix. Also translate the existing English states ("Loading events…" →
  "Ładowanie wydarzeń…", "Retry" → "Spróbuj ponownie", error texts from `EventSourceError`
  → mapped to Polish via an error code, so the adapter messages stay
  language-independent).
- `calendar-formatter.ts`: time range, "Środa, 12 listopada" (capitalised), and PLN price
  formatting.
- `styles.css`: rewrite with CSS custom properties for the tokens in §1. Use container
  queries at 760 px (as in the design), `:focus-visible` outlines, 44 px touch targets, and
  `prefers-reduced-motion`. Dark theme: map the same tokens to dark values so `?theme=dark`
  keeps working. The design is light only, so this needs a quick design review; the Riftbound
  `imgBg #003A51` already works on dark.
- **Fonts**: self-host Inter and Bricolage Grotesque woff2 with the `latin-ext` subset (needed
  for Polish characters) under `src/presentation/assets/fonts/`, with
  `font-display: swap`, instead of loading Google Fonts. That avoids a third-party request
  from every embedding page (GDPR) and adds no runtime dependency.

### 3.5 Embed (`src/embed/`): the hard part

The iframe grows to fit its content, so the host page scrolls and the iframe has no scrolling
of its own. A fixed modal or a bottom sheet is positioned against the **iframe's** viewport,
which can be 1500 px tall and mostly off-screen.

1. **Find the visible part of the iframe.** An `IntersectionObserver` on `<body>` (with
   thresholds every 1 %) reports `intersectionRect` clipped by the top-level viewport, even
   in cross-origin iframes. That gives the visible slice of the iframe.
2. **Place the dialog in that slice.** On desktop, centre the dialog inside the visible
   slice. If the slice is unknown (no IO update yet), fall back to aligning with the clicked
   tile. On mobile, anchor the sheet to the bottom of the visible slice. The dialog uses
   `position: absolute` in document coordinates; this must be checked for a top-layer
   `<dialog>` in Chrome, Safari and Firefox, with a fallback to a non-modal `<dialog>` and a
   manual focus trap.
3. **Height.** Top-layer content doesn't count toward `body`'s height. While the dialog is
   open, a spacer extends `body` so the dialog is never cut off, and `IframeHeightReporter`
   reports that height.
4. **Optional host cooperation.** Add a new message `{ type: 'calendar:focus', top, height }`.
   The host can use it to scroll the dialog into view, for example when the iframe is less
   than half visible. `calendar:resize` stays exactly as it is, and `public/embed-demo.html`
   handles both messages. Also update `embed-demo.html`'s `sandbox` documentation: dialogs
   need nothing extra, and CTAs need the existing `allow-popups` and
   `allow-popups-to-escape-sandbox`.
5. **Standalone page** (not embedded): normal `<dialog>` behaviour plus a body scroll lock.
6. Verify in `embed-demo.html` with Playwright at 1200 px and 390 px. Cases: iframe partly
   scrolled off the top, and a dialog opened from the last row.

### 3.6 Config / composition root

- **(fix) Locale.** The query parameter is `?lang=` (not `?locale=`). `main.ts` currently
  passes `navigator.language`, so the UI language follows the viewer. Add `VITE_LOCALE`
  (default `pl-PL`) and pass it instead; `?lang=en` still overrides. `weekStartsOn` already
  defaults to Monday.
- **(fix) Time zone.** Without `VITE_TIME_ZONE`, times are shown in the _viewer's_ zone. A
  Polish store viewed from London would show 17:00 for an 18:00 tournament. Make the default
  `Europe/Warsaw`, keeping `?tz=` and `VITE_TIME_ZONE` as overrides, and document it.
- **(fix) Clock.** `SystemClock` returns the viewer's local date. Give it the configured time
  zone (`toZonedParts(new Date(), timeZone).date`), so "today", past/upcoming and the
  "DZIŚ" badge match the store's calendar.
- New optional build variables: `VITE_DEFAULT_LOCATION` (the store name and address) and
  `VITE_DEFAULT_SEATS` (default 12). Add them to `.env.example`, `deploy.yml` (build `env`)
  and CLAUDE.md.
- Optional `?game=pokemon|lorcana|…|other` sets the initial filter (unknown → all). This lets
  a store embed a Pokémon-only calendar.
- `main.ts` wires `GoogleEventLinks`, `CARD_DEFAULTS`, the messages and the zoned clock.

## 4. Assets

- Download the four game logos from the design canvas's asset store into
  `src/presentation/assets/games/`. Optimise them (WebP/AVIF or a clean SVG, about 52 px tall
  in tiles and 108 px in the banner, with 2× density).
- Draw a neutral **generic logo** (an SVG card stack) for generic and other-game events.
- ⚠️ The logos are trademarks of Disney/Ravensburger, Riot, Bandai, and The Pokémon Company.
  Stores usually may show them for organised play, but the store owner should confirm before
  launch.

## 5. Delivery in steps (each step = one PR, `npm run check` green)

1. **Data model and parser.** Domain `EventInfo` / game catalogue, `parseEventDescription` +
   `htmlToLines` + warnings, `endTime`, `location` (API fields, iCal, snapshot), zoned clock,
   `VITE_TIME_ZONE`/`VITE_LOCALE` defaults, realistic demo data. The UI is unchanged apart
   from now showing `fullTitle`.
2. **Card model and grid logic.** `buildEventCard` with all defaults, filter and counts,
   trimmed and compact weeks, `findAdjacentEvent` with the 3-month cap.
3. **Visual shell.** Tokens, fonts, Polish messages, header, filter chips, grid, tiles (desktop
   and mobile chips), logos and generic logo.
4. **Details dialog.** Desktop modal and mobile sheet, prev/next, CTAs and "wkrótce" states,
   add-to-calendar and directions links, generic-event layout, focus handling.
5. **Embedding.** Visible-slice positioning, height spacer, `calendar:focus`, embed-demo
   update, Playwright screenshots at 1200 / 390.
6. **Docs.** `docs/event-description.md` for organisers, sync warnings in the Actions
   summary, CLAUDE.md updated (clicking an event now opens details, and the registration link
   lives in the dialog; new variables).

## 6. Tests (co-located Vitest, fake `Clock`)

- **Parser**: aliases, casing, diacritics **including `ł`**; `:`, `=`, and spaced-dash
  separators; URL values containing `:` and `=`; `Uwaga: …` stays a note; `zapisy https://…`
  without a separator becomes a note plus a warning; empty values; first non-empty duplicate
  wins; `---`; `\r\n`; bullets; one-line-per-field.
- **HTML**: Google web editor output (`<br>`, `<p>`, `<div>`, `<ul><li>`), `&nbsp;`, numeric
  entities, `&amp;lt;` decoded once, `<a href="https://www.google.com/url?q=…">Zapisy
tutaj</a>` → the real URL, a `javascript:` href rejected. Markup in a description is
  rendered as text in the view.
- **Values**: every price form (`20`, `20,50`, `20.50`, `20zl`, `0`, `za darmo`, `20–30 zł`,
  `10 €`, `-5`); seats (`24 osoby`, `8-16`, `bez limitu`, `0`, `abc`); links (`www.x.pl`,
  `x.pl/zapisy`, `mailto:`, `javascript:`); `game` (prefix match, several games, unknown
  name, empty).
- **Plurals**: 1, 2, 4, 5, 12, 14, 21, 22, 25, 112.
- **Card model**: each default (TBA format, TBA price, 12 seats, `short_format` derived with
  each split character, `short_title` from the game); a generic event shows only the provided
  fields; an "other game" event gets defaults; past, today and upcoming CTA states; "Wyniki
  wkrótce" for an invalid link.
- **Time**: all-day; multi-day; 20:00–00:00; 18:00–01:00 (see §8); an event without an end;
  DST change weekends (last Sunday of March and of October) in `Europe/Warsaw`; a viewer in
  another zone (the zoned clock).
- **Grid**: 4, 5 and 6 rows (February 2027 starts on a Monday and has 4); compact weeks;
  filter counts count multi-day events once; "Inne" chip only when needed; at most 2 tiles
  plus "+N więcej".
- **Service**: adjacent event across a month boundary; gives up after 3 empty months; uses
  cached ranges (counted with a spy repository).
- **Views (happy-dom)**: tiles are labelled buttons; the dialog opens and closes (Esc, ×,
  backdrop); focus returns to the tile; prev/next across a month boundary keeps the dialog
  open; CTA anchors have `target=_blank` and `rel="noopener noreferrer"`; `aria-current`;
  filter empty state.
- **Adapters**: Google `location` mapped; snapshot round-trip with and without `location`
  (old snapshots still parse); iCal `LOCATION` with escaped commas.

## 7. Decisions taken (change them before step 1 if you disagree)

1. **Seats** means the number of places (the design label "Liczba miejsc"), not live
   availability. Google Calendar cannot know registrations.
2. An **unknown game name** is treated as a game event with generic styling and defaults
   applied. Only a _missing_ `game` line creates a generic event.
3. A missing or invalid `tournament_link` on an upcoming game event shows a disabled
   "Zapisy wkrótce". It does not fall back to the Google event page.
4. The dialog's "n / N" counter counts events **in the visible month** (filter applied).
   Prev/next still crosses months, for up to 3 months.
5. "Past" is decided by the last day in the **store's** time zone, not by end time. On the
   event's day, registration is still shown.
6. Polish is the default UI language (`VITE_LOCALE`, override with `?lang=en`), and
   `Europe/Warsaw` is the default time zone.
7. "Wyniki wkrótce" stays on a past event indefinitely until a results link is added. A
   possible later option is to hide it after N days.

## 8. Edge cases and how they are handled

| #   | Case                                                      | Handling                                                                                                                                                         |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Calendar shared as free/busy only                         | All events become untitled generic events. A prerequisite in the organiser guide. The sync summary warns when more than half the events have no title.           |
| 2   | `pełny tytuł:` (Polish `ł`)                               | Map `ł→l` explicitly (NFD doesn't). Tested.                                                                                                                      |
| 3   | Free text with a colon (`Uwaga: …`, `Link: …`)            | Only known keys are fields; everything else is a note. The generic alias `link` is dropped.                                                                      |
| 4   | URL without a separator (`zapisy https://…`)              | Note + warning. It is never split at `https:`.                                                                                                                   |
| 5   | Google "Insert link" with custom text                     | Take the `<a href>`, unwrap `google.com/url?q=`, and allow `http(s)` only.                                                                                       |
| 6   | Template with an empty line, then the same key filled     | The first non-empty value wins.                                                                                                                                  |
| 7   | Value wrapped onto the next line                          | The second line becomes a note; the guide says one line per field.                                                                                               |
| 8   | Double-encoded or numeric HTML entities                   | Decode once, including `&#…;`.                                                                                                                                   |
| 9   | `short_format` without `·`                                | Split on `·`, `\|`, `,`, `/`, or a spaced dash.                                                                                                                  |
| 10  | Price as a range, with conditions, or in another currency | Shown as typed (capped). Only a pure number becomes "N zł".                                                                                                      |
| 11  | `seats: bez limitu`, `8-16`, `0`                          | "Bez limitu"; the upper bound + warning; 12 + warning.                                                                                                           |
| 12  | Several games in `game`                                   | The first match wins + warning.                                                                                                                                  |
| 13  | Ambiguous short alias (`op`)                              | Removed from the catalogue.                                                                                                                                      |
| 14  | Event 18:00–01:00 (past midnight)                         | **Decision:** a timed event that ends before 06:00 the next day stays a single-day event in the grid but shows "18:00–01:00". Today it would appear on two days. |
| 15  | Event 20:00–00:00                                         | The end time comes from the exact instant ("00:00"), not from instant − 1 ms.                                                                                    |
| 16  | All-day and multi-day events                              | The tile shows "Cały dzień" / "cd."; Termin shows the date range; add-to-calendar uses the exclusive end date.                                                   |
| 17  | No end time / zero-length event                           | Only the start time; add-to-calendar uses start + 1 h.                                                                                                           |
| 18  | DST weekends                                              | `toZonedParts` already handles them; tests are added for the March and October changes.                                                                          |
| 19  | Viewer in another time zone                               | Times and "today" use the store's zone (`Europe/Warsaw` default, zoned clock).                                                                                   |
| 20  | Event with no title and no `full_title`                   | "(Bez tytułu)" (today it shows the English "(No title)").                                                                                                        |
| 21  | Cancelled instance of a recurring event                   | Already filtered (API `status`, iCal `STATUS`/`EXDATE`).                                                                                                         |
| 22  | Results for one instance of a recurring series            | Edit "only this event"; documented.                                                                                                                              |
| 23  | More than 2 events on a day                               | 2 tiles + "+N więcej", which opens the day dialog.                                                                                                               |
| 24  | A filtered month with no events                           | An empty state with "Pokaż wszystkie".                                                                                                                           |
| 25  | `?game=` invalid                                          | Falls back to all games.                                                                                                                                         |
| 26  | Prev/next at the edge of the data                         | At most 3 months of lookahead, then the button is disabled. Ranges match `gridRange()` so the cache is reused.                                                   |
| 27  | Re-render while the dialog is open                        | The dialog has its own host outside the grid root. Stale fetches are dropped by the render token.                                                                |
| 28  | Focus after closing when the tile is gone                 | Focus goes to the month title.                                                                                                                                   |
| 29  | Dialog in a tall auto-height iframe                       | The visible slice comes from IntersectionObserver, plus a height spacer and the optional `calendar:focus` message.                                               |
| 30  | Month row count changes (4–6)                             | The iframe height changes and `calendar:resize` handles it. The host may see a small jump, which is acceptable.                                                  |
| 31  | Snapshot gains `location`                                 | An additive field and `version: 1` stay; one extra redeploy after release.                                                                                       |
| 32  | Very long values (titles, other-game names, notes)        | Caps from §2.3, CSS ellipsis in tiles, full text in the dialog, and notes capped at 2,000 characters.                                                            |
| 33  | Markup or script in any field                             | Always rendered as text with `h()`. Links are `http(s)` only.                                                                                                    |
| 34  | `rel` in the design CTAs                                  | `noopener noreferrer`, as CLAUDE.md requires.                                                                                                                    |
| 35  | `role="grid"` on the current table                        | Removed: there is no grid keyboard model.                                                                                                                        |
| 36  | Logos fail to load                                        | `imgBg` colour + `alt` text keep the tile readable; the generic logo is inlined.                                                                                 |
| 37  | Dark theme                                                | Tokens mapped; needs a design review.                                                                                                                            |
| 38  | Fonts missing Polish glyphs                               | `latin-ext` subsets are self-hosted.                                                                                                                             |

# Plan: tournament calendar redesign (V2 "Kalendarz turniejów")

Source design: Claude Design canvas "TCG Event Calendar — LGS embed", artboard
**V2 · Kalendarz turniejów (PL, okno szczegółów)**. The canvas marks it as the lead version.
Its desktop width is 1200 px and its mobile width is 390 px. V1 and V3 are older explorations
and are out of scope.

## 1. What the design adds compared with today

| Area         | Today                            | V2 design                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header       | `‹ Month Year Today ›`           | Card with the kicker "Kalendarz turniejów", month name in Bricolage Grotesque plus the year in grey, the pill "N wydarzeń w tym miesiącu", and a Poprzedni / Dziś / Następny segmented control.                                                                                                                                                                                                                                                                                                               |
| Filter       | none                             | Game chips "Wszystkie gry" + one per game (colour dot, count badge, `aria-pressed`). On mobile they become a 2-column grid with short labels.                                                                                                                                                                                                                                                                                                                                                                 |
| Grid         | 6×7 table, text links            | Monday first, weekend columns tinted, past day numbers greyed, today shown as a filled badge with a "DZIŚ" label, weeks with no events collapse to a compact row. At most **2 tiles per day** plus "+N więcej".                                                                                                                                                                                                                                                                                               |
| Tile (month) | `<a>` opening the URL            | `<button>` with the game **logo** on a game-coloured background, **short_title**, a clock icon with "18:00–21:00", and a **short_format** pill. Past events are shown at 60 % opacity. On mobile (≤760 px) the tile becomes a coloured chip with a dot and the start time.                                                                                                                                                                                                                                    |
| Details      | none                             | Modal dialog (bottom sheet on mobile, drag down to close). It holds a logo banner (with a "Zakończony" badge for past events), a game label, prev/next event navigation with "n / N", **full_title**, and tiles for Termin, Format (**full_format**), Liczba miejsc (**seats**). Links: "Dodaj do kalendarza" and "Wyznacz trasę". Sticky footer: **Wpisowe** (**price**) plus the CTA "Zapisz się na turniej" (upcoming, links to **tournament_link**) or "Zobacz wyniki" (past, links to **results_link**). |
| Language     | English UI, `navigator.language` | Polish copy throughout, with Polish plurals (miejsce / miejsca / miejsc, wydarzenie / wydarzenia / wydarzeń).                                                                                                                                                                                                                                                                                                                                                                                                 |

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

The parser is forgiving, so a real person typing in the Google Calendar description box gets
the result they expect:

- **Keys** are case-insensitive. Diacritics, spaces, and `-` are normalised to `_`, so
  `Short title`, `short-title`, and `SHORT_TITLE` are the same key. Leading bullets
  (`-`, `*`, `•`) are ignored. Both `:` and `=` work as the separator; the line splits at the
  **first** one, so URLs in values stay intact.
- **Polish aliases** are accepted for every key:

  | Key               | Aliases                                         |
  | ----------------- | ----------------------------------------------- |
  | `game`            | `gra`                                           |
  | `short_title`     | `krotki_tytul`, `tytul_krotki`                  |
  | `full_title`      | `tytul`, `pelny_tytul`, `title`                 |
  | `short_format`    | `krotki_format`                                 |
  | `full_format`     | `format`, `pelny_format`                        |
  | `price`           | `wpisowe`, `cena`, `fee`                        |
  | `seats`           | `miejsca`, `liczba_miejsc`                      |
  | `tournament_link` | `zapisy`, `rejestracja`, `link`, `registration` |
  | `results_link`    | `wyniki`, `results`                             |

- An empty value (`results_link:`) means "not provided". This lets organisers keep the full
  template in every event and fill it in later.
- If a key appears more than once, the **first** occurrence wins.
- Lines with an unknown key or no separator are **notes** and are shown as plain text. A line
  containing only `---` ends the fields: everything after it is notes, even if it looks like
  `key: value`.
- HTML from the Google web editor (`<br>`, `<p>`, `<div>`, `<li>`, auto-linked
  `<a href>…</a>`, `&nbsp;`) becomes text before parsing. The existing `stripHtml` needs
  block tags added as line breaks. iCal descriptions are already plain text.

### 2.3 Values, validation, and defaults

The adapter stores only what was actually provided, so the domain keeps facts rather than
defaults. The application layer applies the defaults below, which keeps them in one testable
place.

| Field             | Accepted input                                                                                                                                                   | Invalid / missing on a **game event**                                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game`            | Matched against the game catalogue aliases: `pokemon`, `pokémon`, `ptcg`, `pokemon tcg`, `one piece`, `op`, `optcg`, `lorcana`, `disney lorcana`, `riftbound`, … | Missing makes the event **generic** (see 2.4). An unknown name (e.g. `Magic`) is an "other game" event: generic logo and colours, but the typed name is shown as the label and the defaults below still apply. |
| `short_title`     | text, trimmed and capped at 40 characters                                                                                                                        | The game's short name ("Pokémon"), as the design's tiles show.                                                                                                                                                 |
| `full_title`      | text, capped at 120 characters                                                                                                                                   | The Google event title.                                                                                                                                                                                        |
| `full_format`     | text                                                                                                                                                             | **"TBA"**                                                                                                                                                                                                      |
| `short_format`    | text                                                                                                                                                             | The first segment of `full_format` before `·`, otherwise **"TBA"**.                                                                                                                                            |
| `price`           | `20`, `20 zł`, `20zl`, `20 PLN`, `20,50` → "20 zł" / "20,50 zł". `0`, `free`, `darmowe`, `bezpłatnie` → "Bezpłatnie". Other text is shown as typed.              | **"TBA"**                                                                                                                                                                                                      |
| `seats`           | First integer in the value (`24`, `24 osoby`), between 1 and 999                                                                                                 | **12**                                                                                                                                                                                                         |
| `tournament_link` | `http(s)` URL. `www.…` / bare domains get `https://` added. Anything else (`javascript:`, garbage) is rejected.                                                  | The CTA becomes a disabled "Zapisy wkrótce".                                                                                                                                                                   |
| `results_link`    | same as above                                                                                                                                                    | On past events the CTA becomes a disabled "Wyniki wkrótce". On upcoming events results are never shown.                                                                                                        |

### 2.4 Generic events (no `game` line)

These are meant for store closures, open days, release parties, and similar events.

- They use the **generic logo** (a neutral card-stack icon) and neutral colours. They have no
  game label and are listed under an extra **"Inne"** filter chip, which appears only when the
  month has such events.
- By default they show only **title, date/time and location** (plus notes).
- Any field that _is_ provided and valid is shown. **No defaults are applied**: no "TBA", no
  "12 miejsc", and no disabled "Zapisy/Wyniki wkrótce" buttons. The footer is hidden entirely
  when there is neither a price nor a link.

### 2.5 Organiser-facing deliverables

- `docs/event-description.md`, written in Polish: a copy-paste template, a table of keys and
  aliases, a full game example, a generic example, and what each default looks like.
- Parser **warnings** (unknown key, unknown game, invalid link, unparseable seats) are returned
  next to the parsed result. `sync-ical.ts` writes them to the GitHub Actions step summary, so
  a typo becomes visible after the next scheduled sync. The browser ignores them.
- Note for recurring events (weekly leagues): every instance inherits the description. To add
  `results_link` to one instance, edit "only this event" in Google Calendar.

## 3. Architecture changes (respecting the layer rules)

```
infrastructure: raw-event.ts ── parseEventDescription() ──► domain: CalendarEvent + EventInfo (facts)
application:    buildEventCard(event, today, defaults) ───► EventCard (defaults applied, semantic)
presentation:   CalendarView / EventTile / EventDialog ───► DOM (Polish copy, game theme, logos)
```

### 3.1 Domain (`src/domain/`)

- `calendar-event.ts`: add `endTime?: TimeOfDay`, `location?: string`, and `info: EventInfo`.
  `title`, `url`, and `description` stay as they are (`description` becomes the notes).
- New `event-info.ts`:
  ```ts
  type GameRef = { kind: 'known'; id: GameId } | { kind: 'other'; name: string };
  type Price =
    | { kind: 'free' }
    | { kind: 'amount'; minor: number }
    | { kind: 'text'; text: string };
  interface EventInfo {
    game?: GameRef;
    shortTitle?: string;
    fullTitle?: string;
    shortFormat?: string;
    fullFormat?: string;
    price?: Price;
    seats?: number;
    registrationUrl?: string;
    resultsUrl?: string;
  }
  ```
- New `game-catalog.ts`: `GameId = 'lorcana' | 'riftbound' | 'onepiece' | 'pokemon'`, with
  `name`, `shortName`, and `aliases` for each, plus `findGame(text)`, which compares normalised
  strings. This is pure data; colours and logos live in presentation. Adding a game later means
  one catalogue entry, one theme entry, and one logo.
- New port `EventLinks` in `ports.ts`: `addToCalendarUrl(event)` and
  `directionsUrl(location)`. This keeps Google URLs out of components, as CLAUDE.md requires.

### 3.2 Infrastructure (`src/infrastructure/`)

- New `event-description-parser.ts` (pure, the most heavily tested file):
  `parseEventDescription(text): { info: EventInfo; notes?: string; warnings: string[] }`.
- `raw-event.ts`: `RawEvent` gains `location?`. `toCalendarEvent()` calls the parser, fills
  `endTime` (today `resolve()` throws the end time away), and keeps the shared mapping for
  both sources. `stripHtml` treats `</p>`, `</div>`, `<li>` as new lines.
- `google-calendar-event-repository.ts`: add `location` to `FIELDS` and map it.
- `event-snapshot.ts` + `scripts/ical/ical-to-snapshot.ts`: write and read the optional
  `location` field (iCal `LOCATION`). This is an **additive** change, so `version: 1` stays.
  Old pages ignore the field, and new pages treat its absence as "no location".
- New `google-event-links.ts` implements `EventLinks`. It builds
  `calendar.google.com/calendar/render?action=TEMPLATE…&ctz=<timeZone>` (all-day events use
  `YYYYMMDD/YYYYMMDD+1`) and `google.com/maps/dir/?api=1&destination=…`.
- `demo-event-repository.ts`: generate realistic tournament events (the design's weekly
  rhythm: Mon Lorcana, Tue Riftbound, Fri One Piece, Sat Pokémon, plus one generic event and
  one event with missing fields). This exercises every default in the demo.

### 3.3 Application (`src/application/`)

- New `event-card.ts`: `buildEventCard(event, today, defaults)` → `EventCard`:
  ```ts
  { variant: 'game' | 'other-game' | 'generic'; gameId?: GameId; gameLabel?: string;
    tileTitle: string; title: string; tileFormat?: FieldValue; format?: FieldValue;
    price?: PriceValue; seats?: number; location?: string; notes?: string; isPast: boolean;
    registration?: LinkState; results?: LinkState }   // LinkState = {kind:'link',url} | {kind:'pending'}
  ```
  `FieldValue` / `PriceValue` include `{ kind: 'tba' }`, so the copy ("TBA") stays in
  presentation. `CARD_DEFAULTS = { seats: 12 }` can be overridden through `main.ts`.
  `isPast` means the last day < today (the same rule as the design).
- `month-grid.ts`: drop leading/trailing weeks that are fully outside the month (the design
  shows 5 rows when 5 are enough), add `isCompact` for weeks without events, and add a
  `game` filter (`'all' | GameId | 'other'`) plus per-game counts for the chips.
- `calendar-service.ts`: `getMonthView(month, filter)` and `getAdjacentEvent(id, direction,
filter)` for prev/next in the dialog. At a month boundary it loads the neighbouring month,
  which is cheap because of `CachingEventRepository`.

### 3.4 Presentation (`src/presentation/`)

Split the current 200-line `CalendarView` into focused renderers, all using `h()` and never
`innerHTML`:

- `calendar-view.ts`: state (month, filter, open dialog) and the loading/error flow
  (unchanged contract: `show()` never rejects).
- `month-header.ts`: kicker, title, count pill, nav group.
- `game-filter.ts`: chips (`role="group"`, `aria-pressed`).
- `month-grid-view.ts`: weekday header and cells. Keep **semantic table markup**
  (`<table>/<th scope=col>`, `aria-current="date"`). The design's CSS grid layout can be done
  with `display: grid` on the `tr`, or by styling the table. Cells hold up to 2 `EventTile`s
  plus a "+N więcej" button that opens the day dialog.
- `event-tile.ts`: desktop tile and mobile chip. Both are `<button>` (opens the dialog), with
  an `aria-label` such as "Pokémon, 11:00–16:00, Standard — pokaż szczegóły".
- `event-dialog.ts`: native `<dialog>` with `showModal()` (focus trap, Esc, inert page) and a
  close button. It contains the banner, `<dl>` tiles (Termin, Miejsce, Format, Liczba miejsc;
  rows not applicable to generic events are omitted), notes as text, the extlinks, and the
  sticky footer. CTAs are real `<a target="_blank" rel="noopener noreferrer">`. Disabled
  "Zapisy wkrótce" / "Wyniki wkrótce" are `<span aria-disabled="true">`, not links. Mobile:
  bottom-sheet CSS plus a touch drag-to-close (>90 px) on the banner, as in the design.
- `game-theme.ts`: `GameId | 'generic'` → `{ color, tint, dot, imgBg, logoUrl }`. Logos are
  imported from `src/presentation/assets/games/*.{png,svg}` so Vite hashes them and they
  work under `base: './'`.
- `messages.ts`: Polish strings plus `plural(n, one, few, many)`. Keep an `en` dictionary,
  chosen by `config.locale`. The default locale becomes `pl-PL` and the week starts on
  Monday (still overridable by query string).
- `calendar-formatter.ts`: add the time range, "Środa, 12 listopada" (capitalised), and PLN
  price formatting (`Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })`).
- `styles.css`: rewrite with CSS custom properties for the tokens in §1. Use container
  queries at 760 px (as in the design), `:focus-visible` outlines, and
  `prefers-reduced-motion` to disable the tile hover lift and sheet transition. Dark theme:
  map the same tokens to dark values so `?theme=dark` keeps working (the design is light only,
  so this needs a quick design review).
- **Fonts**: self-host Inter and Bricolage Grotesque woff2 with the `latin-ext` subset (needed
  for Polish characters) under `src/presentation/assets/fonts/`, instead of loading Google
  Fonts. That avoids a third-party request from every embedding page (GDPR) and adds no
  runtime dependency.

### 3.5 Embed (`src/embed/`): the hard part

The iframe grows to fit its content, so a `position: fixed` modal is centred in a possibly
1500 px tall iframe and can open off-screen on the host page. Plan:

1. On desktop, position the dialog **absolutely near the clicked tile** (clamped to the
   document) instead of centring it in the viewport. On mobile, anchor the sheet to the tile's
   row as well.
2. While the dialog is open, make sure the document is tall enough for it (`min-height`), so
   the reported iframe height includes it.
3. Call `dialog.scrollIntoView({ block: 'nearest' })`. Browsers scroll ancestor frames where
   allowed.
4. Add an **optional** message `{ type: 'calendar:focus', top, height }` that host pages can
   use to scroll. The existing `calendar:resize` shape stays exactly as it is (backward
   compatible), and `public/embed-demo.html` shows how to handle the new message.
5. Verify in `embed-demo.html` with Playwright at 1200 px and 390 px.

### 3.6 Config / composition root

- New optional build variables: `VITE_DEFAULT_LOCATION` (the store name and address used when
  an event has no location) and `VITE_DEFAULT_SEATS` (default 12). Add them to `.env.example`,
  `deploy.yml` and CLAUDE.md.
- Optional `?game=pokemon` query parameter for the initial filter. This lets a store embed a
  Pokémon-only calendar.
- `main.ts` wires `GoogleEventLinks`, `CARD_DEFAULTS`, and the messages.

## 4. Assets

- Download the four game logos from the design canvas's asset store into
  `src/presentation/assets/games/`. Optimise them (PNG → WebP/AVIF or a clean SVG, about 52 px
  tall in tiles and about 108 px in the banner).
- Draw a neutral **generic logo** (an inline-style SVG of a card stack) for generic and
  other-game events.
- ⚠️ The logos are trademarks of Disney/Ravensburger, Riot, Bandai, and The Pokémon Company.
  Stores usually may show them for organised play, but the store owner should confirm before
  launch.

## 5. Delivery in steps (each step = one PR, `npm run check` green)

1. **Data model and parser.** Domain `EventInfo` / game catalogue, `parseEventDescription`
   (+ warnings), `endTime`, `location` (API fields, iCal, snapshot), HTML-to-lines fix,
   realistic demo data. The UI is unchanged apart from now showing `fullTitle`.
2. **Card model and grid logic.** `buildEventCard` with all defaults, filter and counts,
   trimmed and compact weeks, adjacent-event lookup.
3. **Visual shell.** Tokens, fonts, Polish messages, header, filter chips, grid, tiles (desktop
   and mobile chips), logos and generic logo.
4. **Details dialog.** Desktop modal and mobile sheet, prev/next, CTAs and "wkrótce" states,
   add-to-calendar and directions links, generic-event layout.
5. **Embedding.** Dialog positioning inside an auto-height iframe, `calendar:focus`,
   embed-demo update, Playwright screenshots at 1200 / 390.
6. **Docs.** `docs/event-description.md` for organisers, sync warnings in the Actions
   summary, CLAUDE.md updated (clicking an event now opens details, and the registration link
   lives in the dialog).

## 6. Tests (co-located Vitest, fake `Clock`)

- **Parser**: aliases and casing and diacritics; `:` vs `=`; URL values containing `:`; empty
  values; duplicates (first wins); `---` separator; notes; HTML input from the Google web
  editor (including `<a href>` auto-links and `&nbsp;`); `javascript:` and garbage links
  rejected; `www.` links upgraded; every price form; seats from "24 osoby"; out-of-range
  seats; unknown game becomes `other`; warnings content.
- **Card model**: each default (TBA format, TBA price, 12 seats, short_format derived from
  full_format, short_title from the game); generic event shows only the provided fields; past
  vs upcoming CTA states; "Wyniki wkrótce" when the link is invalid.
- **Grid**: 5 vs 6 rows, compact weeks, filter counts, "Inne" chip only when needed, at most
  2 tiles + "+N więcej".
- **Views (happy-dom)**: tiles are buttons with labels; the dialog opens and closes (Esc,
  backdrop, ×); prev/next across a month boundary; CTA anchors have `target=_blank` and `rel`;
  no `innerHTML` (markup in a description renders as text); `aria-current="date"`.
- **Adapters**: Google `location` mapped; snapshot round-trip with and without `location`
  (old snapshots still parse).

## 7. Decisions taken (change them before step 1 if you disagree)

1. **Seats** means the number of places (the design label "Liczba miejsc"), not live
   availability. Google Calendar cannot know registrations.
2. An **unknown game name** is treated as a game event with generic styling and defaults
   applied. Only a _missing_ `game` line creates a generic event.
3. A missing or invalid `tournament_link` on an upcoming game event shows a disabled
   "Zapisy wkrótce". It does not fall back to the Google event page.
4. The dialog's "n / N" counter counts events **in the current month** (with the filter
   applied). Prev/next still crosses months.
5. "Past" is decided by date (as in the design), not by end time.
6. Polish is the default UI language. English stays available through `?locale=en`.

# Plan: monthly PNG poster for Facebook ("Plakat miesiąca")

Goal: a page for the store staff that turns the events of a chosen month into a PNG they can
post on the store's Facebook page. It reuses the data pipeline that the calendar already has
(the same sources, `toCalendarEvent()`, `visible: nie`, defaults in `buildEventCard`). It must
not appear in the embedded calendar and must not be linked or indexed anywhere.

> **Status:** proposal, nothing is implemented yet. The open questions are in §9.

## 1. Where it lives and who can reach it

### 1.1 The honest constraint

GitHub Pages is static and public. Anything in `dist/` can be downloaded by anyone who knows the
URL; Pages has no login, and we cannot send headers. So "not public" can mean one of two things:

**Decision: a custom (secret) URL is sufficient.** The page is unlisted rather than protected:
only people who know the URL can open it. That is acceptable because the poster only shows events
that are already public in the calendar, so a leaked URL lets someone draw a picture of public
data, nothing more. A private export through GitHub Actions was considered and is out of scope
(§8).

### 1.2 The unlisted page

- A second Vite entry, `poster.html`, with its own script `src/poster-main.ts`.
- **Only built when the repository variable `POSTER_SLUG` is set** (e.g. `plakat-7Hq2xk9F`, at
  least 12 random characters). A small Vite plugin in `vite.config.ts` adds the entry and renames
  the output to `dist/<POSTER_SLUG>.html`. Without the variable the production build has no
  poster at all (the default, so existing deployments do not change). `npm run dev` always
  serves it at `/poster.html`.
- The file stays at the top level of `dist/` (not in a sub-folder), so `base: './'` and the
  relative asset paths keep working.
- `<meta name="robots" content="noindex, nofollow">` and `<meta name="referrer" content="no-referrer">`
  (so the slug does not leak in `Referer` headers when a link is opened from the page).
- Nothing links to it: not `index.html`, not `embed.js`, not README examples. It is not in a
  `robots.txt` either, because that would publish the path.
- **Never inside an iframe:** `poster-main.ts` checks `window.self !== window.top` first and, when
  framed, renders a one-line message and stops. A JS check, not a `frame-ancestors` CSP, because
  the CSP rule in CLAUDE.md is about the calendar page and a page-wide header is not possible on
  Pages anyway.
- No `calendar:*` messages: the page does not load anything from `src/embed/`.
- Its JS is a separate chunk. The calendar bundle must not grow; check `dist/assets` sizes before
  and after.
- Rotating the URL = changing `POSTER_SLUG` and pushing. The old file disappears with the next
  deployment.

## 2. Facebook format

Facebook shows feed images at the width of the post, which on a phone is about 360–430 CSS px.
Everything is designed for that.

| Decision          | Value                                                                                        | Why                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Aspect ratio      | **4:5 portrait, 1080 × 1350** (default); **1:1, 1080 × 1080** as an option                   | 4:5 is the tallest ratio the mobile feed shows uncropped; square is the safe choice for carousels/shares. |
| Export resolution | Draw at 1080 logical px, export at **2×** (2160 × 2700). Option 1×.                          | Facebook re-compresses and resizes uploads (long edge ≈ 2048 px); a larger source keeps text sharp.       |
| File type         | **PNG**, opaque background, sRGB                                                             | Text and flat colours survive Facebook's re-compression far better as PNG than JPEG; no transparency.     |
| Safe margin       | 64 px on every side; nothing important within it                                             | Rounded corners and the feed's crop at different widths.                                                  |
| Minimum text size | 28 px logical (≈ 10 px on a phone); body 34–38 px; titles 40–44 px; month name 96–110 px     | Readable at the feed width without zooming.                                                               |
| Contrast          | 4.5:1 or better for all text (reuse the `color`/`tint` pairs from `game-theme.ts`)           | Same accessibility rule as the calendar.                                                                  |
| Multiple pages    | When the events do not fit, split into **"1/2", "2/2"** images with the same ratio           | A multi-photo post (carousel) keeps all images at one ratio; mixing ratios makes Facebook crop them.      |
| Links             | Not clickable in an image. A **caption generator** (§4.4) produces the post text with links. | Registration links go in the post text, not in the picture.                                               |

### 2.1 Layout (not a month grid)

A 7-column grid at 1080 px gives ~140 px per day, which is about 50 px on a phone: unreadable.
The poster is an **agenda list** grouped by day, in the V2 visual language (same tokens, fonts,
game colours and logos as `docs/plans/tournament-design.md` §1):

```
┌──────────────────────────────────────────────┐
│  KALENDARZ TURNIEJÓW                    (1/2) │  kicker, Inter 700, muted
│  Listopad 2026                                │  Bricolage 800, year in grey
│  [● Pokémon 4] [● Lorcana 3] [● One Piece 2]  │  per-game counts (only games present)
│──────────────────────────────────────────────│
│  ┌────┐  ┌────┐ League Challenge        20 zł │  date block | game logo on imgBg |
│  │ 14 │  │LOGO│ 18:00–21:00 · Standard        │  short_title + time + short_format |
│  │ SOB│  └────┘                                │  price on the right (or TBA)
│  └────┘  ┌────┐ Set Championship        30 zł │  2nd event on the same day: no new
│          │LOGO│ 12:00 · Draft                 │  date block, rows share it
│  ...                                          │
│──────────────────────────────────────────────│
│  Zapisy i szczegóły: <VITE_POSTER_FOOTER>     │  footer text from config
│  <VITE_DEFAULT_LOCATION>                      │  store address
└──────────────────────────────────────────────┘
```

- Rows are cards with the game `tint` as background and the logo on `logoBg`, like the month tiles.
- Weekends: date block uses the weekend tint from the calendar, so Saturdays stand out.
- Multi-day events: one row on the first day, date block "14–15" (or "31.10–2.11" across months).
- Long titles: shrink one step, then wrap to two lines, then ellipsis (`…`) using `measureText`.
- Generic events (no `game:`) use the generic logo and theme; their missing fields are not drawn
  (same rules as `EventCard`, no "TBA" for them).
- **Density levels** before splitting into pages: `comfortable` (2-line rows) → `compact`
  (1-line rows: time · title · price) → paginate. With ≤ 8 events one 4:5 page is comfortable;
  ~14 fit compact; more go to page 2.
- Empty month: a friendly "Turnieje wkrótce" poster instead of an empty list (and a warning in
  the controls that it is probably not what they want to post).

## 3. Architecture

Follows the layer rules; nothing in `src/` needs a new runtime dependency (Canvas 2D, `FontFace`
and `toBlob` are built in, so no `html2canvas`).

```
domain            (unchanged)
application/
  poster.ts               buildPosterModel(): month + cards → days → rows (pure)
  poster-pagination.ts    paginate(rows, measure, page height) → pages (pure)
  poster-caption.ts       buildPosterCaption(): the post text (pure)
presentation/poster/
  poster-renderer.ts      draws one page on a 2D context (no DOM besides the context)
  poster-layout.ts        sizes, margins, type scale per format/density (constants)
  poster-assets.ts        waits for fonts and decodes logo images
  poster-page.ts          the controls and preview, built with h()
src/wiring.ts             shared factories (createRepository, createService) used by both roots
src/poster-main.ts        composition root of the poster page
poster.html               the page shell (noindex)
```

### 3.1 `application/poster.ts` (pure, unit-tested)

```ts
interface PosterOptions {
  readonly filter: GameFilter; // reuse the calendar's filter
  readonly includeEnded: boolean; // default: false for the current month, true for past months
}
interface PosterRow {
  readonly card: EventCard;
  readonly dateLabel: DateSpan; // single day or a span, for "14" / "14–15"
}
interface PosterDay {
  readonly date: PlainDate;
  readonly isWeekend: boolean;
  readonly rows: readonly PosterRow[];
}
interface PosterModel {
  readonly month: YearMonth;
  readonly days: readonly PosterDay[];
  readonly counts: FilterCounts; // reuse countByFilter from month-grid.ts (export it)
  readonly total: number;
}
```

- Events: those **starting** in the month (same rule as `monthEvents`), plus events that started
  in the previous month and are still running on day 1 (shown on day 1 with the span label).
- Order: reuse `compareEvents`. Cards: reuse `buildEventCard` with the service's `cardDefaults`.
- Add `CalendarService.getPosterModel(month, options)` that calls `findInRange` for the month's
  grid range (cache-friendly) and then `buildPosterModel`.

### 3.2 `application/poster-pagination.ts` (pure)

Takes the rows, a `measureRow(row, density) → height` function and the available height.
Returns `{ density, pages: PosterDay[][] }`: `comfortable` if everything
fits on one page, else `compact`, else compact pages split **between days** (a day is never split
unless it alone is taller than a page). Pure, so every overflow case is a plain unit test.

### 3.3 `presentation/poster/poster-renderer.ts`

- Signature: `renderPosterPage(ctx: PosterContext, page, layout, assets, text)`, where
  `PosterContext` is the subset of `CanvasRenderingContext2D` we use (`fillRect`, `fillText`,
  `measureText`, `drawImage`, `roundRect`, `font`, `fillStyle`, …). Tests pass a recording fake.
- Draws at logical size; the caller sets `ctx.scale(2, 2)` for 2× export.
- All strings come from `messages.ts` (new `poster` section, PL + EN) and `CalendarFormatter`
  (month name, weekday short names, times, prices). Plurals via the existing `plural()`.
- Text is drawn with `fillText`, so event data can never inject markup (no `innerHTML`, no SVG
  `foreignObject`).

### 3.4 `presentation/poster/poster-assets.ts`

- Fonts: `await document.fonts.load('800 110px "Bricolage Grotesque"', 'Listopad ŁŚŻ')` and the
  Inter weights used, **with Polish sample text**, so the `latin-ext` file (selected by
  `unicode-range`) is fetched too; then `document.fonts.ready`. Without this the first export
  uses fallback fonts.
- Logos: `new Image()` with the URLs from `game-theme.ts`, `await img.decode()`. Same origin, so
  the canvas is not tainted and `toBlob` works.
- Draw only after both resolve; show "Przygotowuję…" meanwhile.

### 3.5 `presentation/poster/poster-page.ts` (controls)

- Month picker (‹ month ›, default: **next month** after the 20th of the month, otherwise the
  current one, because posters are usually made ahead of time); game filter chips (reuse
  `game-filter.ts`); format 4:5 / 1:1; "Pokaż zakończone"; resolution 2× / 1×.
- Live preview: one `<canvas>` per page, scaled down with CSS.
- **"Pobierz PNG"** per page: `canvas.toBlob(…, 'image/png')` → `URL.createObjectURL` →
  `<a download="turnieje-2026-11-1.png">` → click → revoke. A real anchor (the CLAUDE.md link
  rule), no `window.open`. On iOS Safari, where `download` may open the image in a new tab, the
  image can be saved with a long press; add one line of help text for it.
- **"Kopiuj opis posta"**: `navigator.clipboard.writeText(caption)`, with a read-only
  `<textarea>` showing the same text as a fallback.
- Errors from the repository: same pattern as `CalendarView`, an error state with "Spróbuj
  ponownie"; never a rejected promise.

### 3.6 Composition roots

CLAUDE.md says `main.ts` is the only composition root. The poster page needs a second one:

- Move `createSource` / `createRepository` (and the `parseConfig` defaults block) from `main.ts`
  to `src/wiring.ts`; `main.ts` and `poster-main.ts` both call it, so both pages read the same
  sources in the same order (API first, snapshot fallback).
- Update CLAUDE.md ("composition roots: `main.ts` and `poster-main.ts`, sharing `wiring.ts`")
  and the README project tree.
- `parseConfig` already ignores unknown params; the poster reuses `?month=`, `?game=`, `?lang=`.

### 3.7 Config

New build-time variables (README, `.env.example`, `deploy.yml` env block):

| Variable             | Meaning                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `POSTER_SLUG`        | File name of the poster page; unset ⇒ the page is not built at all.  |
| `VITE_POSTER_FOOTER` | Footer line, e.g. "Zapisy i szczegóły: sklep.pl/turnieje". Optional. |

The store address reuses `VITE_DEFAULT_LOCATION`. `POSTER_SLUG` is read only by `vite.config.ts`
(not `VITE_*`), so it is not baked into any bundle that the calendar page loads.

## 4. Caption text (`poster-caption.ts`)

Plain text for the Facebook post, because the image cannot hold links:

```
🗓️ Turnieje w listopadzie 2026

sob 14.11 · 18:00 · Pokémon – League Challenge · 20 zł
  Zapisy: https://…
ndz 15.11 · 12:00 · Lorcana – Set Championship · 30 zł
  Zapisy: https://…

📍 <VITE_DEFAULT_LOCATION>
```

Only `http(s)` links (already validated by the adapters). Events with a "pending" link get
"Zapisy wkrótce". Same filter and `includeEnded` as the image.

## 5. Implementation steps

Each step ends with `npm run check` green and its own commit.

1. **Pure model.** Export `countByFilter` and `compareEvents` where needed; add
   `poster.ts` + tests (month boundaries, multi-day spans, `includeEnded`, filter, generic events,
   ordering, an empty month).
2. **Pagination.** `poster-pagination.ts` + tests (fits comfortable, needs compact, two pages,
   a day never split, a single huge day, zero rows).
3. **Caption.** `poster-caption.ts` + messages (PL/EN) + tests (pending links, prices, plurals).
4. **Renderer.** `poster-layout.ts`, `poster-renderer.ts`, `poster-assets.ts` with a recording
   fake context: assert every `fillText` stays inside the safe area, the month name and each
   event title are drawn, long titles are truncated, past events are dimmed, 1:1 and 4:5 both
   work. Text measurement in the fake: fixed width per character.
5. **Page + wiring.** `poster.html`, `poster-main.ts`, `wiring.ts`, `poster-page.ts`; the Vite
   plugin for `POSTER_SLUG`; the framed-page guard (test: with `window.top !== window.self`,
   nothing but the message is rendered). DOM tests for the controls with happy-dom.
6. **Visual check.** Use the pre-installed Playwright locally to open `/poster.html` on the dev
   server with demo data and a dense month, export both formats, and look at the PNGs at phone
   size. Not part of `npm run check` (no browser in CI checks).
7. **Docs + deploy.** README section "Plakat na Facebooka" (where the URL comes from, how to
   rotate it, posting tips), `.env.example`, `deploy.yml` (`POSTER_SLUG`, `VITE_POSTER_FOOTER`),
   CLAUDE.md update.

## 6. Tests that guard the important promises

- The production build **without** `POSTER_SLUG` has no `poster` HTML or chunk in `dist/`
  (a small test of the Vite plugin's input/rename function, kept pure).
- `index.html`, `embed.js` and the calendar bundle contain no reference to the slug or to
  `poster` (assert in the plugin test that the main entry is unchanged).
- Framed → no poster UI.
- `visible: nie` events never appear (covered by `toCalendarEvent()`, plus one poster test).
- Every drawn string is inside the safe margin, for both formats and both densities.

## 7. Edge cases

- **Months outside the iCal snapshot window** (`ICAL_PAST_MONTHS` / `ICAL_FUTURE_MONTHS`): the
  poster would be empty. Show a warning in the controls when the source is the snapshot and the
  month is outside its range.
- **Snapshot staleness:** with iCal only, data can be up to ~10–30 minutes old (scheduled sync).
  Show "Dane z: <generatedAt>" in the controls (not in the image).
- **Time zone:** times use `config.timeZone` (the store's), never the viewer's.
- **Cancelled/hidden events** are already dropped by `toCalendarEvent()`.
- **Very long game names** for `other-game` events: truncate like titles.
- **Fonts failing to load** (offline): still render with the fallback stack, show a warning.
- **Price formats:** reuse the formatter used by the dialog ("20 zł", "Bezpłatne", "TBA").
- **Locale EN:** `?lang=en` gives an English poster; the default follows `VITE_LOCALE`.
- **High event counts** (> ~28): three or more pages; Facebook allows many photos per post, but
  show a hint that a game filter (one poster per game) may read better.

## 8. Out of scope

- Posting to Facebook automatically (needs a Page access token, a server and app review).
- Instagram/Stories formats (9:16). The layout constants make it a small follow-up.
- Real authentication on Pages (impossible without a server), and a private export through a
  GitHub Actions workflow artifact. The custom URL was chosen instead (§1.1).

## 9. Open questions for the store

1. Should the header show the **store's name or logo**? If so, which asset (and licence)?
2. Footer text: which URL should people type (the page that embeds the calendar)?
3. Default: one poster for all games, or one poster per game?

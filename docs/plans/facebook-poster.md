# Plan: monthly PNG for Facebook ("Grafika miesiąca")

A staff page that turns the events of a chosen month into a PNG for the store's Facebook page.
It reuses the calendar's data pipeline (the same sources, `toCalendarEvent()`, `visible: nie`,
the defaults in `buildEventCard`) and the look of the calendar page.

> **Status:** implemented. This document records the decisions and how the feature is built.
> How to use it is in the README, "Facebook image".

## 1. Decisions

| Question  | Decision                                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Look      | The calendar page itself (month grid, tiles, logos), slightly adapted. Earlier list, "trading card" and print-style drafts were rejected. |
| Content   | Only the month name, the site and the events. No kicker, no event count, no "Zapisy i szczegóły", no slogans.                             |
| Accent    | `#9A17FA`, only on the day numbers of event days (and the "+N" marker). Weekends keep the page's grey.                                    |
| Site      | `booster-ziomki.pl`, from `VITE_POSTER_SITE` (not hard-coded). No store logo.                                                             |
| Scope     | One image per month with every game. No game filter.                                                                                      |
| Formats   | **Post** 4:5 and **page cover** 16:9, both a seven-column month grid.                                                                     |
| Access    | A secret address is enough (§2). A private export through GitHub Actions is out of scope.                                                 |
| Post text | Not generated. (An earlier draft had a caption generator.)                                                                                |

## 2. Where it lives and who can reach it

GitHub Pages is static and public: there is no login and no way to send headers. So the page is
**unlisted, not protected**. That is acceptable because it only draws events that are already
public in the calendar.

- `poster.html` + `src/poster-main.ts` are a second Vite entry.
- A production build includes it **only when `POSTER_SLUG` is set** and renames it to
  `<POSTER_SLUG>.html` (`posterPage()` in `vite.config.ts`; the slug is validated by
  `scripts/poster/poster-slug.ts`: 12–64 letters, digits or dashes, and a bad value fails the
  build instead of publishing under a guessable name). `npm run dev` always serves `/poster.html`.
- `POSTER_SLUG` is a repository **secret**. A variable would be printed in the build log, which
  is public for a public repository; secrets are masked there.
- The file stays at the top level of `dist/`, so `base: './'` keeps working.
- `noindex, nofollow` and `referrer: no-referrer`; nothing links to the page.
- It refuses to run inside a frame (`window.self !== window.top`) and loads nothing from
  `src/embed/`.
- The poster code is its own chunk. `presentation/index.ts` does not export it, so the calendar
  bundle does not contain it (it grew by under 1 kB: the copy in `messages.ts` and the config).
- Changing the secret and deploying moves the page; the old file disappears.

## 3. Formats

| Format | Logical size | Scale | PNG         | Notes                                                            |
| ------ | ------------ | ----- | ----------- | ---------------------------------------------------------------- |
| Post   | 960 × 1200   | 2.25  | 2160 × 2700 | 4:5, the tallest ratio the mobile feed shows without cropping.   |
| Cover  | 1200 × 676   | 2     | 2400 × 1352 | 16:9. Content stays in the band y = 110…566 (`COVER_SAFE_BAND`). |

Facebook shows the whole 16:9 cover on phones and crops its top and bottom on desktop, so the
cover is vertically centred and leaves the outer bands empty. PNG with an opaque background keeps
text sharper than JPEG after Facebook's recompression.

### 3.1 Post

Header (month in Bricolage Grotesque 800, grey year, black site pill), then the grid card filling
the rest. Each event is the page's tile: logo on the game's background, title (up to two lines),
time range, format pill.

Row heights: weeks without events get a low row (44 px); the others share the remaining height
equally unless one needs more. When the month does not fit, the layout tries, in order:

1. full tiles;
2. no format pill;
3. smaller logo and one-line titles;
4. an even smaller logo;
5. the same four tile sizes with at most 4, 3, 2, then 1 tile per day, and a purple "+N" next to
   the day number for the rest.

It always prefers showing every event over a richer tile. With one event per day (the store's
rhythm: Monday, Tuesday, Friday, Saturday) even a six-week month uses full tiles without the
format pill at worst.

### 3.2 Cover

Rows are at most 72 px (60 px in a six-week month), so an event is laid out sideways: day number
and logo on the left, title (two lines, one in six-week months) and time on the right, no format
pill. One event per day; more are counted in "+N".

### 3.3 Both

- Days of the neighbouring months keep their number but not their events.
- Events are never dimmed as "past" and today is not marked: the image is not tied to the day it
  was made.
- Multi-day events appear on each of their days, like in the calendar ("cd." on later days).
- The page reports how many events are hidden behind "+N".

## 4. Architecture

```
src/presentation/poster/
  poster-content.ts          MonthView → strings and logo URLs (PosterContent)
  poster-layout.ts           PURE: PosterContent + format + text measurer → draw operations
  poster-painter.ts          paints the operations on a 2D context
  canvas-poster-surface.ts   <canvas>, font and image loading, PNG export
  poster-page.ts             staff UI: month, format, preview, download
  poster.css
src/wiring.ts                event sources + CalendarService, shared by both composition roots
src/poster-main.ts           composition root of the poster page
poster.html
scripts/poster/poster-slug.ts
```

- **Data** comes from the existing `CalendarService.getMonthView()`; no new use-case was needed.
- **Layout is a display list.** `layoutPoster()` returns `rect` / `text` / `image` / `clip`
  operations in logical pixels. All sizing, wrapping, ellipsis and overflow rules are there and
  are tested with a fake text measurer, without a canvas.
- **No dependency.** Canvas 2D, `document.fonts` and `toBlob` are built in. Event text only ever
  reaches the image through `fillText`, so it cannot inject markup.
- **Fonts first.** `CanvasPosterSurface.prepare()` loads every weight with a Polish sample string
  (so the `latin-ext` files are fetched) before anything is measured.
- **Shadows** ignore the canvas transform, so the painter multiplies them by the scale.
- **Generic logo.** Events without a catalogue game use `genericLogo()` serialised to an SVG data
  URL, so the canvas draws it like any other logo.
- **Download** is a real `<a download href="blob:…">`; `PosterPage.show()` never rejects and shows
  a retry button on failure (also when the browser cannot export the canvas).
- **Composition roots.** `main.ts` used to be the only one. Source and service wiring moved to
  `wiring.ts` so both pages read the same events in the same order.

## 5. Configuration

| Name               | Kind                  | Meaning                                                      |
| ------------------ | --------------------- | ------------------------------------------------------------ |
| `POSTER_SLUG`      | repository **secret** | File name of the page; unset ⇒ the page is not built.        |
| `VITE_POSTER_SITE` | repository variable   | Text of the pill, e.g. `booster-ziomki.pl`; unset ⇒ no pill. |

URL parameters on the page: `?month=YYYY-MM`, `?lang=`, `?tz=` (the same parser as the calendar).

## 6. Known limits

- **Not access-controlled.** Anyone with the address can open the page (§2).
- **Cover text is small on phones** (the cover is about 640 px wide there). Logos and day numbers
  read; titles and times mostly do not.
- **Two events on one day in every week** fit on the post only with the smallest tiles, and not
  in a six-week month, where the second one becomes "+1".
- **Snapshot window.** With the iCal source, months outside `ICAL_PAST_MONTHS` /
  `ICAL_FUTURE_MONTHS` are empty, and data can be as old as the last scheduled sync.
- **Older browsers** without `ctx.letterSpacing` draw the title with normal spacing.
- **The cover's safe band** follows Facebook's current crop and was not verified on a live page.

## 7. Out of scope

- Posting to Facebook automatically (needs a Page token, a server and app review).
- Stories format (9:16) and a caption generator.
- Real authentication (impossible on Pages) and a private export as a GitHub Actions artifact.

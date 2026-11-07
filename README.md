# Calendar

An interactive month calendar for embedding in other pages with an `<iframe>`. It is a static
site, deployed to GitHub Pages by GitHub Actions.

- Events can be clicked and open in a **new tab** (for now every event points to `https://www.google.com/`).
- **Demo data:** one event per month on a pseudo-random day. The days are deterministic, so they
  stay the same across reloads.
- **Iframe-ready:** the widget sends its height to the host page, so the iframe can resize without
  scrollbars.
- Uses the browser's locale by default; you can set the locale, the first day of the week and the theme through URL parameters.
- No runtime dependencies (vanilla TypeScript). The bundle is about 3.5 kB gzipped.

## Quick start

Requirements: Node.js ≥ 22.12 (see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script                  | Purpose                                         |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | Vite dev server with HMR                        |
| `npm run build`         | Type-check + production build into `dist/`      |
| `npm run preview`       | Serve the production build locally              |
| `npm run test`          | Unit tests (Vitest + happy-dom)                 |
| `npm run test:coverage` | Tests with V8 coverage report                   |
| `npm run lint`          | ESLint (strict, type-checked, layer boundaries) |
| `npm run format`        | Prettier                                        |
| `npm run check`         | Everything CI runs, in one command              |

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Push to `main`, or run the _Deploy to GitHub Pages_ workflow manually.

The site is published at `https://<user>.github.io/<repo>/`. The Vite config uses
`base: './'`, so the build works under any sub-path with no extra configuration.

Workflows:

- `.github/workflows/ci.yml` runs format, lint, typecheck, tests (with coverage) and the build on
  every pull request and on every branch except `main`.
- `.github/workflows/deploy.yml` runs the full check on `main`, builds the site and deploys it
  with the official `actions/deploy-pages`.

## Embedding

```html
<iframe
  id="calendar"
  src="https://<user>.github.io/<repo>/?lang=en-US&weekStart=1"
  title="Event calendar"
  style="width:100%; height:640px; border:0"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
></iframe>

<script>
  // Optional: auto-resize the iframe to its content.
  const frame = document.getElementById('calendar');
  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    if (event.data?.type === 'calendar:resize') frame.style.height = `${event.data.height}px`;
  });
</script>
```

If you use `sandbox`, you need both `allow-popups` and `allow-popups-to-escape-sandbox`. Without
them, clicking an event cannot open the new tab, or the new page opens with the iframe's sandbox
restrictions. A working example is deployed at `/embed-demo.html` (source:
`public/embed-demo.html`).

### URL parameters

| Parameter      | Example               | Default           | Description                                            |
| -------------- | --------------------- | ----------------- | ------------------------------------------------------ |
| `month`        | `2026-03`             | current month     | Month shown first                                      |
| `lang`         | `pl-PL`               | browser language  | Locale used for month and weekday names                |
| `weekStart`    | `0` (Sun) / `1` (Mon) | `1`               | First day of the week                                  |
| `theme`        | `light` / `dark`      | system preference | Colour theme                                           |
| `parentOrigin` | `https://example.com` | `*`               | Target origin for resize `postMessage` (lock it down!) |

### Resize message contract

```ts
{ type: 'calendar:resize', height: number } // CSS pixels, sent on load and on every layout change
```

## Architecture

The code follows Clean / Hexagonal Architecture and the SOLID principles. Dependencies only point
inwards, and ESLint enforces this (`no-restricted-imports` for each layer).

```
src/
├── domain/          Pure model + ports. No DOM, no I/O.
│   ├── plain-date.ts       timezone-free date value object
│   ├── year-month.ts       month value object & arithmetic
│   ├── calendar-event.ts   CalendarEvent entity
│   └── ports.ts            EventRepository, Clock (interfaces)
├── application/     Use-cases; depend only on domain ports.
│   ├── month-grid.ts       pure 6×7 grid builder (view-model)
│   └── calendar-service.ts "get month view" use-case
├── infrastructure/  Adapters implementing domain ports.
│   ├── demo-event-repository.ts  one seeded-random event per month
│   ├── seeded-random.ts          mulberry32 PRNG
│   └── system-clock.ts
├── presentation/    DOM rendering (no innerHTML → XSS-safe), CSS, Intl formatting.
├── embed/           Iframe integration (height reporter via postMessage).
├── config/          Query-string → typed AppConfig.
└── main.ts          Composition root: the only place wiring concrete classes.
```

How the SOLID principles show up in the code:

- **S**: each module has one reason to change (grid maths, formatting, rendering, embedding, config).
- **O/L**: you add a new data source by writing another `EventRepository` (for example a JSON or REST
  adapter). The existing code does not change.
- **I**: the ports are small (`findByMonth`, `today`).
- **D**: the application layer depends on abstractions. `main.ts` injects the concrete classes.

### Replacing demo data with real events

Implement the port and swap it in `src/main.ts`:

```ts
export class HttpEventRepository implements EventRepository {
  constructor(private readonly baseUrl: string) {}
  async findByMonth({ year, month }: YearMonth): Promise<readonly CalendarEvent[]> {
    const res = await fetch(
      `${this.baseUrl}/events?month=${year}-${String(month).padStart(2, '0')}`,
    );
    return parseEvents(await res.json()); // validate at the boundary
  }
}
```

## Tech stack

Vite 8, TypeScript 6 (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`),
Vitest 5 + happy-dom, ESLint 10 (`typescript-eslint` strict type-checked), Prettier 3,
Dependabot for npm and GitHub Actions.

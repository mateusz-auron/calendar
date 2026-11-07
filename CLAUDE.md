# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repository.

## What this is

A static, embeddable month calendar (vanilla TypeScript + Vite). Other sites load it in an
`<iframe>`, and GitHub Pages hosts it (deployed by `.github/workflows/deploy.yml`). Clicking an
event opens its URL in a new tab. The current events are demo data: one per month, on a seeded
random day.

## Commands

```bash
npm install            # setup (Node >= 22.12, see .nvmrc)
npm run dev            # dev server
npm run check          # format:check + lint + typecheck + test  (run before every commit)
npm run build          # production build -> dist/
npm run test:watch     # TDD loop
npx vitest run src/application/month-grid.test.ts   # a single test file
```

CI must stay green. `npm run check` runs the same steps as CI.

## Architecture (strict, lint-enforced)

Dependencies only point inwards:

```
domain  <-  application  <-  presentation | infrastructure | embed | config  <-  main.ts
```

- `src/domain/`: pure types, value objects (`PlainDate`, `YearMonth`) and **ports**
  (`EventRepository`, `Clock`). No DOM, no `fetch`, no `Date.now()`.
- `src/application/`: use-cases (`CalendarService`) and pure view-model builders
  (`buildMonthGrid`). Imports only from `domain`.
- `src/infrastructure/`: adapters that implement the ports (`DemoEventRepository`, `SystemClock`).
- `src/presentation/`: DOM rendering (`CalendarView`), `Intl` formatting and `styles.css`.
- `src/embed/`: iframe concerns (`IframeHeightReporter`, which sends `postMessage` to the parent).
- `src/config/`: parses query-string parameters into a typed `AppConfig`.
- `src/main.ts`: the **composition root**. It is the only file that instantiates concrete classes.

`eslint.config.js` encodes these boundaries with `no-restricted-imports`. If lint reports a
boundary error, move the code to the correct layer or add a port. Do not disable the rule.

## Conventions

- **SOLID / DI**: classes receive their collaborators through the constructor. To add a capability,
  add a port in `domain/ports.ts` and an adapter in `infrastructure/`, then wire both in `main.ts`.
- **Dates**: always use `PlainDate` / `YearMonth`. Months are **1-based**. Do not pass JS `Date`
  objects across layers. `Intl` formatting uses `timeZone: 'UTC'` with `Date.UTC(...)`.
- **DOM**: build elements with `h()` from `presentation/dom.ts`. **Never use `innerHTML`**, because
  event data must not be able to inject markup.
- **Event links** must be real `<a href target="_blank" rel="noopener noreferrer">`, not
  `window.open`. Popup blockers and iframe sandboxes allow anchors, and anchors are accessible.
- **Iframe**: keep `base: './'` in `vite.config.ts`. Do not add anything that breaks framing (for
  example a `frame-ancestors` CSP or `X-Frame-Options`). Keep the `calendar:resize` message shape
  backward compatible, because host pages depend on it.
- **Accessibility**: use semantic table markup, `aria-current="date"` for today, labelled buttons,
  and visible `:focus-visible` styles.
- **TypeScript**: strict mode with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
  Use `import type` for types. Avoid `any` and non-null `!`.
- **Tests**: co-located `*.test.ts` files (Vitest + happy-dom). Test pure logic directly and test
  views through the DOM. Inject a fake `Clock` instead of mocking the system date. Every bug fix
  needs a test that would have caught it.
- **Style**: Prettier (single quotes, 100 columns). Files use kebab-case. One main export per module.
  Each layer has an `index.ts` barrel.

## Deployment

A push to `main` runs `deploy.yml` (check, build, `upload-pages-artifact`, `deploy-pages`). The
repository's Pages source must be set to **GitHub Actions**. Only `dist/` is published. Files in
`public/` (for example `embed-demo.html`) are copied into it as they are.

## Out of scope / don'ts

- Do not add a UI framework or runtime dependencies without a clear need. The bundle is tiny on purpose.
- Do not commit `dist/` or `coverage/`.
- Do not hard-code URLs in components. They come from config or the repository.

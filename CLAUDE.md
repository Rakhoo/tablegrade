# Notenfeder – notes for Claude Code

## Working together

- Repo, Cloudflare project, database file (`tablegrade.sqlite3`) and PIN salt keep the name
  "tablegrade". Do not rename them.
- Store memories only about the developer, never about the app's user. The account email
  belongs to the app's user. Do not use it.
- Talk to the developer in **German**. All Markdown files, code and comments are in
  **English**. JSDoc on exported functions/components, not overloaded. All UI texts in
  **German**.
- **Commits:** Never commit unasked. Only when told to "commit" or similar: commit **and**
  push (both together), one-line English message.
  - **On `main`** the developer stays in charge: only the developer commits and pushes. On request,
    only provide the commit message, based on the staged changes (`git diff --staged`). If
    nothing or not everything is staged, first ask whether to stage, as a choice with buttons
    (AskUserQuestion), not as a text question.
  - If a push would trigger a workflow although the commit changes nothing relevant for it,
    add `[skip deploy]` (deploy, server image; on `main` and `dev`) or `[skip ci]` (all
    workflows, e.g. CI for documentation-only changes) to the message.
  - No commit message in a report unless asked.
- Check with `npx tsc -b --noEmit`, `npm run lint`, `npm run build`. **No browser tests**
  unless a concrete problem is reported or a change explicitly needs one. Say honestly what was
  checked and what was not. After code changes, apply the project skill `clean-check`
  (`.claude/skills/clean-check/`) before reporting.
- Make decisions with a reasonable default yourself and name them in the report; only ask for
  real turning points.
- Keep `README.md` up to date with feature changes (do not run Prettier on the README, it would
  reformat the whole document; Prettier on `src/` is fine).

## Keep context small

- Read only what the task needs: targeted `grep`/excerpts instead of whole files, no long
  output, no repeating earlier steps.
- Short answers: what changed, what was decided, what is open/untested.
- Communicate by ASD-STE100 (Simplified Technical English), applied to German. More detail only
  when asked. Check every sentence against these rules before sending:
  - Instructions max. 20 words, descriptions max. 25 words.
  - One statement per sentence. No semicolons.
  - Parentheses only for code, paths or numbers, never for a second statement. No dashes as
    insertions.
  - Active voice. Exception: the git state, e.g. "gestagt", "committet".
  - Steps and several results as lists. Result first, then details.
  - Fixed terms, always the same word for the same thing: Anmeldung (not Login/Anmeldeweg),
    Sitzung (not Session), Gerät, Schlüssel, Deploy, Commit, Branch.
  - No filler words: bewusst, ausdrücklich, eigentlich, einfach, quasi, ja, halt, wohl, and "noch" as filler ("noch nicht" for "not yet" is fine).
  - No idioms.
  - A bold label with a colon is followed by one statement only; more go into a sub-list.
- Forgetting older parts of the conversation is fine; the code, the README and this file are
  what counts.

## Purpose of the app

Offline PWA for teachers: weekly timetable, seating plan per lesson (warning, grading,
commenting, arranging), overview table per class and school year half with grades, exams,
projects, retakes/project extensions, partial and half year grades, export (PDF/CSV), class
editor with student lists (also WebUntis PDF), learning names, settings with backup.

**Privacy is central:** All data lives on the device (SQLite in the browser). No analytics, no
data to third-party services. Holidays come from mehr-schulferien.de (without personal data).
Optional (in the settings, off by default): account and sync via the developer's own server
with **end-to-end encryption**; the server only sees ciphertext, wrapped keys, HMAC ids and
timestamps. Sign-in with passkey, Microsoft or Google; apart from these sign-ins no
third-party services. Without an account the app works as before. The app only runs installed
(a browser tab shows only installation instructions; `npm run dev`/local runs in a tab).

## Tech stack (fixed)

- React 19, TypeScript, Vite, **VitePWA**, **SQLocal** (OPFS, needs COOP/COEP) + **Drizzle**,
  MUI (+ MUI X Date Pickers), Tailwind CSS 4, React Router (hash routing), date-fns,
  pdfjs-dist (WebUntis import), jsPDF (export).
- Crypto and sync in the client only with browser APIs (WebCrypto, WebAuthn, IndexedDB, fetch,
  WebSocket); tests with Vitest (`npm test`, end-to-end test against the server
  `npm run test:e2e`).
- Sync server: **Go** in `server/` (SQLite via `modernc.org/sqlite`, WebAuthn, OIDC,
  WebSocket), runs with Docker Compose on a Raspberry Pi, reachable via Tailscale Funnel.
- Hosting: Cloudflare Pages via GitHub Actions; `public/_headers` sets COOP/COEP. GitHub
  Actions builds the server image to GHCR, a systemd timer on the Pi pulls it.
- Not: plaintext data on the server, tracking, third-party cloud backends. No new dependencies
  without asking.
- The files named in VitePWA `includeAssets` and as apple-touch-icon must exist (exception:
  `mask-icon.svg`).
- DB: `BASELINE` in `src/db/migrations.ts` is the schema of the first release (version 20, as
  the data on the iPad). Only append new migrations (append-only, never change existing ones).
- Client–server interface: [docs/protocol.md](docs/protocol.md). Changes there affect both
  sides and the test vectors in `server/testdata/`.

## Finding your way in the code

- `README.md`: features, project structure, routes, state concept, data model; look there
  first.
- UI patterns: a page's functions live in the speed dial (`SpeedDial.tsx`) or mode bar
  (`ModeBar.tsx`); every explainable element gets a `data-help` attribute with German text for
  the help (cards with inner elements: `data-help-group`; the same explanation on many
  elements: `data-help-repeat`; see README).
- Shared state: undo history `useEditHistory`, display options `useDisplayOption`; data comes
  through the route loaders and is reloaded after changes via `useRevalidator`.

## Folder structure (follow it)

- `src/features/<page>/`: one folder per route with `<Name>Page.tsx` and `<name>Loader.ts`,
  plus the components used only there (e.g. `overview/TableCells.tsx`). When a page grows,
  split it into sub-components in the same folder instead of growing one file (guideline:
  component files under ~500 lines).
- `src/components/`: UI used by several pages (`PageHeader`, `SpeedDial` +
  `speedDialEntries`, `ModeBar`, dialogs, icons); larger related parts as subfolders
  (`components/help/`).
- `src/hooks/`: reusable hooks and shared UI state.
- `src/lib/`: pure logic without side effects (no DOM/DB access), e.g. grade rules
  (`createMarkRules` in `lessonChains.ts`; do not rebuild them in pages), `gradeTools`, `paths`.
- `src/services/`: side effects to the outside (holiday API, backup, PWA, PDF import/export).
- `src/crypto/`: pure crypto logic with WebCrypto (no DOM, no DB). `src/sync/`: account and
  sync (network, DB), rules like `src/services/`; the UI uses only `src/sync/index.ts`.
- `server/`: Go sync server, its own `go.mod` (see `server/README.md`).
- `src/db/`: schema, migrations, client; access only via `src/db/queries/*`, exported via
  `src/db/index.ts`.
- `docs/`: protocol and concepts.
- Build URLs only via `paths` (`src/lib/paths.ts`), never as string literals; add new routes to
  `router.tsx`, `paths.ts` and the page name to `lib/returnPage.ts`.

## Coding rules (follow them)

- Function components with named exports, PascalCase files for components, camelCase for
  everything else. Props as their own `type <Name>Props`.
- React: compute derived values during render instead of mirroring them in state/effects;
  effects only for real synchronization with the outside (DOM, storage, listeners). Stable keys
  from data, no array indices; no object/array literals as default props (use a module
  constant).
- Solve repeated things (header, speed dial entries, rules, way back) with the existing
  building blocks instead of copying; merge duplicates when touching them.
- Short and readable: early returns, small named helper functions, no dead imports or
  variables, no shadowed names (no-shadow).
- Comments: JSDoc (`/** … */`) on exports, components, props fields and local helper
  functions; inline `//` only for non-obvious steps inside a function. English, concise,
  explains the why instead of the what.
- Do not weaken the lint rules in `.oxlintrc.json`; exceptions only one at a time with
  `oxlint-disable-next-line` and a short reason above it.
- Run Prettier on `src/` after changes.

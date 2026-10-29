# Tablegrade

Offline-first PWA for teachers, built for an iPad: a weekly timetable and a classroom seating
plan for recording symbol grades, comments and warnings per lesson. The UI is German only;
code and comments are English.

## Privacy

All data stays on the device: SQLite in the browser (SQLocal on top of OPFS), no backend, no
accounts, no analytics. Student data never leaves the device unless the user exports a backup.
The only network request fetches school holidays from
[mehr-schulferien.de](https://www.mehr-schulferien.de) (no personal data is sent).

## Features

- **Timetable** (`/timetable`): week picker (Monday–Friday only) and the timetable of the
  selected week, one row per lesson.
  - Lessons are colored tiles per subject; double lessons span two rows.
  - Lesson-free hours show `FREI` with dashed slots that create a new class for that slot;
    vacations show `FERIEN`, public holidays `FEIERTAG`.
  - Long press on a day header marks the day as `AUSFALL` (illness, bridge day, …) or makes
    it regular again. Existing entries of that day must be confirmed and are then deleted.
  - Week arrows, "Heute" and month switching in the calendar select whole weeks.
  - "⋯" menu: export / import a backup of the whole database.
- **Classroom** (`/classes/:id?date=YYYY-MM-DD`): seating plan of one lesson.
  - *Ermahnung* (default mode): each tap cycles a student through yellow → red → none.
  - *Bewerten*: choose a tool (grade symbol, delete, comment) and tap students to apply it.
  - *Anordnen*: drag students to whole or half seats; dropping onto a student swaps both.
  - Arrows jump to the previous/next lesson of any class, skipping weekends, holidays and
    cancelled days. "Stunde zurücksetzen" deletes the selected parts of this lesson's entries.
- **Class edit dialog** (`/classes/new`, `/classes/:id/edit`): school year, half, level and
  letter, weekday, lesson, double lesson, subject and the student list (paste a list, or copy
  the students of another class).

## Stack

React 19, TypeScript, Vite, VitePWA, SQLocal + Drizzle ORM, MUI (+ MUI X date pickers),
Tailwind CSS 4, React Router (hash routing), date-fns.

## Development

Requires Node.js 24 (same as CI).

```bash
npm install
npm run dev
```

| Script                        | Purpose                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| `npm run dev`                 | development server (service worker enabled in dev)         |
| `npm run build`               | type check and production build into `dist/`               |
| `npm run preview`             | serve the production build locally                         |
| `npm run lint`                | oxlint                                                     |
| `npm run generate-pwa-assets` | render `public/apple-touch-icon.png` from its SVG source   |

SQLocal needs cross-origin isolation. The dev server gets the headers from the SQLocal Vite
plugin; in production `public/_headers` sets `Cross-Origin-Embedder-Policy` and
`Cross-Origin-Opener-Policy` for Cloudflare Pages.

## Deployment

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): it
builds the app and publishes `dist/` to the Cloudflare Pages project `tablegrade`. The
repository needs the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Project structure

```
src/
├── main.tsx, router.tsx, App.tsx   entry point, routes, root layout (theme, German locale)
├── theme.ts, index.css             MUI theme and CSS design tokens
├── components/                     shared UI: ConfirmDialog, GradeIcon, icons
├── features/
│   ├── timetable/                  timetable page, grid, Ausfall dialog, backup menu
│   └── classroom/                  classroom page, seat grid, tools, dialogs
├── db/
│   ├── schema.ts                   Drizzle tables and row types
│   ├── migrations.ts               ordered SQL migrations
│   ├── client.ts                   SQLocal connection, migrations, import/export
│   └── queries/                    data access per entity
├── services/                       holiday API, backup file handling
├── hooks/                          useLongPress
└── lib/                            pure helpers: dates, school year, lessons, seating,
                                    grades, warnings, subject colors, formatters
public/                             _headers and icons
pwa-assets.config.ts                generator config for the PNG home screen icon
```

Conventions: components (and their CSS) in PascalCase files with named exports, everything
else in camelCase files; JSDoc on exported functions and components.

## Data model

| Table              | Content                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `Classes`          | recurring lesson: subject, level/letter, school year + half, day, hour  |
| `Students`         | names; shared between classes when copied from another class            |
| `Classes2Students` | class membership and seat (`x`, `y` in half-seat cells)                 |
| `Grades`           | per class, student and date: symbol, comment, warnings (0–2)            |
| `Holidays`         | cached holiday periods, flagged as summer vacation / public holiday     |
| `CancelledDays`    | dates marked as "Ausfall"; nothing is graded on these days              |

The SQL table names are kept for compatibility; the TypeScript names differ (e.g.
`schoolClasses`, `classStudents`).

### Migrations

[src/db/migrations.ts](src/db/migrations.ts) is an append-only list; the number of applied
migrations is stored in `PRAGMA user_version`. To change the schema, append a new entry
(never edit an existing one) and update `schema.ts` accordingly. Migrations run on every
connect and after importing a backup, so older backups are upgraded automatically.

### Backup and restore

The "⋯" menu on the timetable exports the database as `tablegrade-YYYY-MM-DD.sqlite3`
(share sheet on iPad, download elsewhere). Importing checks the SQLite file signature, asks
for confirmation, replaces the database, runs the migrations and reloads the app. This is
also the way to move data to another device.

## Domain rules

- **Grade symbols** ([src/lib/grades.ts](src/lib/grades.ts)): ✪ sehr gut, ⊕ gut,
  ○ befriedigend (default tool), ⊖ ausreichend, ⊗ mangelhaft, ⦸ entschuldigt. "entschuldigt"
  has `isGrade: false` and must not count in evaluations.
- **School year**: starts the day after the summer holidays (fallback August 1st). The
  second half starts on the dates in `SECOND_HALF_STARTS`
  ([src/lib/schoolYear.ts](src/lib/schoolYear.ts)), taken from the NRW Ferienordnung
  (<https://bass.schule.nrw/191.htm>); unknown years fall back to February 1st.
- **Holidays**: fetched for Ahlen (NRW) for the current and the next two years and cached in
  the database; offline the cache is used.
- **Seating**: the room is a 20 × 20 grid of half seats, a student covers 2 × 2 cells (10 × 10
  students). New students get the first free seat of a default layout
  ([src/lib/seating.ts](src/lib/seating.ts)), then any free whole seat.
- **Lessons per day**: 9 (`LESSONS_PER_DAY`).

## Yearly maintenance

- Add the next school year to `SECOND_HALF_STARTS` in `src/lib/schoolYear.ts`.
- The calendar's earliest date is `MIN_DATE` in
  `src/features/timetable/TimetablePage.tsx`, the earliest selectable school year is
  `FIRST_SCHOOL_YEAR` in `src/lib/schoolYear.ts`.

## Styling

Design tokens (colors, radii, shadows) live in [src/index.css](src/index.css) and are
mirrored for MUI in [src/theme.ts](src/theme.ts). MUI styles are placed in the CSS layer
`mui` (declared before `components` and `utilities`), so Tailwind classes reliably override
MUI defaults without `!important`.

## Icons

| File                          | Used for                                              |
| ----------------------------- | ----------------------------------------------------- |
| `public/favicon.svg`          | browser tab, manifest icon (`any`)                    |
| `public/maskable-icon.svg`    | manifest icon (`maskable`, motif in the safe zone)    |
| `public/apple-touch-icon.svg` | source of the home screen icon                        |
| `public/apple-touch-icon.png` | iPad/iPhone home screen (180 × 180, generated)        |

iOS does not accept SVG home screen icons and scales the 180 px PNG for iPads itself. After
changing `apple-touch-icon.svg`, run `npm run generate-pwa-assets`. `index.html` also
references `mask-icon.svg`, which intentionally does not exist.

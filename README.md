# Notenfeder

Offline-first PWA for teachers, built for an iPad: a weekly timetable and a classroom seating
plan for recording symbol grades, comments and warnings per lesson. The UI is German only;
code and comments are English.

Design: the app icon shows a raven on a fountain pen nib whose slit ends in a check mark.
The mascot appears as a silhouette in the current theme's colors next to the timetable's
title and in empty seating plans and overview tables, the nib as the tool "Vorschlag" and as
the loading indicator (on start while the database is prepared, and when a page takes a moment
to load). The full icon is shown on the install page.

The app was called "tablegrade" before. The repository, the Cloudflare Pages project, the
database file in the browser (`tablegrade.sqlite3`) and the salt of the PIN hash keep that name,
as renaming them would break the deployment or lose stored data.

## Privacy

All data stays on the device: SQLite in the browser (SQLocal on top of OPFS), no analytics.
Without an account there is no backend: student data never leaves the device unless the user
exports a backup. The only network request then fetches school holidays from
[mehr-schulferien.de](https://www.mehr-schulferien.de) (no personal data is sent).

Sync between devices is optional and off by default (settings, "Konto & Sync"). With it, the
app encrypts every record and photo on the device before upload. The own server
([server/](server/README.md)) only sees ciphertext, wrapped keys, hashed IDs and time stamps.
Nobody but the user can read the data or reset the recovery key. Details:
[docs/sync-plan](docs/sync-plan/README.md) and [protocol.md](docs/sync-plan/protocol.md).

## Features

- **Speed dial** (top right, [src/components/SpeedDial.tsx](src/components/SpeedDial.tsx)):
  collapsed it only shows *Hilfe*, the caret opening it and, on the pages of a class, buttons
  to its other pages (seating plan or overview table, labelled in landscape), which never
  cover the page (only the calendar card a bit); open it lists all further features of the page with their
  labels on the left, above everything else. Without any usable entry (e.g. in the settings)
  the caret is grayed out, disabled and opens nothing. Display options are real switches showing the
  icons of both states; their label says what is shown now ("Bilder sichtbar", "Volle Namen",
  "Nach Nachname sortiert", …) and a second line what a tap does ("Tippen: ausblenden")
  (`displaySwitch` in [src/components/speedDialEntries.tsx](src/components/speedDialEntries.tsx)), and all icon buttons of the open dial share their width, as do the
  labels (centered); label and icon button form one pill. *Einstellungen* is always the last entry. Modes are no part of it: classroom and overview
  table choose them with small text toggle buttons in the top left corner of the bar below the
  header, with undo/redo in its top right corner and the mode's hint or grading tools below.
  - *Hilfe* explains everything on the screen at once: each element with a `data-help` text
    gets a callout connected to it by a line ([src/components/help/](src/components/help/HelpOverlay.tsx): component, collecting the elements, placement, geometry),
    placed so it covers neither the explained elements nor other callouts.
    With the dial collapsed it explains the page, open only the dial itself. Large areas like
    the seating plan cannot be avoided, they get their callout inside; a tap anywhere closes it.
    Cards (`data-help-group`: mode bar, grading tools, timetable side bar, overview table and
    class list) only get a short explanation with "Mehr anzeigen", which hides everything else
    and explains the elements inside the card, with the callouts outside it where there is
    room; "Zurück" returns. The open dial needs no such step. Lines may cross but never run
    along each other or point at another line; they rather touch their element off the middle
    of its side or come from another side. Swiping still scrolls the page below; callouts follow their elements,
    elements scrolled into view get one, and explanations shared by many elements
    (`data-help-repeat`, e.g. dates, names and cells of the overview table) sit at the fully
    visible one (not cut off or covered, e.g. by the sticky header) closest to the middle of
    the visible area. `data-help-place` asks for a callout inside its element (centered, e.g.
    the settings sections) or above or below it, `data-help-skew` frames slanted elements like
    the dates with their slant.
  - At the top left seating plan and overview table lead back to the main page shown last,
    "Stundenplan" (in the week of the lesson) or "Übersichten"; after a reload (an update, or
    the app reopening its last page) that is unknown and both lead to "Stundenplan"
    ([src/lib/mainPage.ts](src/lib/mainPage.ts) keeps the last one in memory and how the main
    pages were last shown). The overview selection always leads back to the timetable,
    in the week last shown; settings, class editor and name cards go one real step back
    and name the page they came from ([src/lib/returnPage.ts](src/lib/returnPage.ts)); editor
    and name cards are pages of their own (`…/edit`, `…/names`) whose speed dial only holds the
    help and the settings.
  - Seating plans and overview tables share one undo/redo across their modes and pages, shown
    as two pills with the step's mode and description. A step made on another page first
    opens that page (the page change itself is no step); the main pages end the history. Each
    step is named after its mode (*Ermahnung* or *Maßnahme*, *Bewertung*,
    *Kommentar*, *Anordnung*; struck through for removals) and describes the student and value
    ([src/hooks/useEditHistory.ts](src/hooks/useEditHistory.ts)).
- **Timetable** (`/timetable`): week picker (Monday–Friday only) and the timetable of the
  selected week, one row per lesson, with its start and end time below the number once the
  lesson times are set; optionally only the days and lessons with classes (see Settings).
  - Lessons are colored tiles: the subject sets the hue, the level the shade (5 light, Q2
    dark); double lessons span two rows. Badges show the lesson types, shortened: a project
    (extension) reads "Proj.", a retake "N.Klausur", or only "…" after a project on the same
    date.
  - Lesson-free hours show `FREI` with dashed slots that create a new class for that slot;
    vacations show `FERIEN`, public holidays `FEIERTAG`.
  - Long press on a day header or a lesson marks it as `AUSFALL` (illness, bridge day, …) or
    makes it regular again. Existing entries must be confirmed and are then deleted.
  - Complete lessons show a check mark, here, in the classroom and in the overview, judged by
    the oral grades (or "abwesend") of all students; an exam by its marks. In the overview
    the retake and project columns get their own check marks: complete once every student
    without that mark on another date of the exam or project has one here. In a retake lesson
    the oral grades only count for those not writing it. For exam, retake and project marks
    "abwesend" counts as no entry, so the mark stays due (e.g. via a retake or extension).
  - Swiping the timetable switches weeks, swiping the calendar switches months.
  - In landscape the calendar column sits on the left and the week bar above the timetable;
    in portrait calendar and controls (week bar included) sit above it. "Neue Klasse" and
    "Übersichten" are among the controls.
  - Week arrows and month switching in the calendar select whole weeks; "Heute" removes
    the `date` parameter and returns to the clean start state (current week).
- **Classroom** (`/classes/:id?date=YYYY-MM-DD`): seating plan of one lesson.
  - Modes: *Ermahnen* (default, set in the settings), *Bewerten*, *Kommentieren* and
    *Anordnen*. The speed dial holds *Bearbeiten* (class
    editor), *Namen lernen* (flash cards for classes with photos), "Stunde zurücksetzen" (in red) and the
    switches for zoom, photos, duties and traits.
  - *Ermahnen*: each tap cycles a student through yellow → red → none.
  - *Bewerten*: the tool bar (grade symbols, "abwesend", suggestion, lesson type, marks for
    exams and projects and one delete tool at the right for both) stays open below the header;
    tapping a student applies the tool (the suggestion shows the nib of the app icon). The suggestion is the
    default tool; without previous grades it suggests the shown symbol closest to a plain 3,
    the better one of two equally close. Erasing a student with several grades in the lesson
    (oral, project, retake) first asks which one to delete, or all.
  - *Kommentieren*: the only place for comments. Speech bubbles show their first words, a tap
    edits the comment or starts a new one.
  - *Anordnen*: drag students to whole or half seats; dropping onto a student swaps both.
  - "Zoom" zooms in on the smallest part of the room holding
    all seated students. The seats get larger, not the text, so longer names and larger photos
    fit; each direction grows on its own, so that part fills the plan from corner to corner,
    inside the same padding as unzoomed. The choice is kept per device;
    arranging always shows the whole room.
  - Names too long for their seat (zoomed or not) first get a smaller font (down to 8 px);
    only if one line is still not enough, they take two lines, breaking at spaces and
    hyphens, then also splitting words with a hyphen; only if three lines would still be
    needed, the name is cut off with "…"
    ([src/components/FitText.tsx](src/components/FitText.tsx)). Photos are the largest
    circle fitting the seat, so they keep the padding on all sides.
  - Seats show the photo with one colored dot per trait around it (fixed slot per trait,
    colors in the settings) and a student's duty as a white symbol on its color at the top
    left; with a warning both sit side by side, slightly overlapping, the duty in front.
    "Legende" in the bottom left corner (while traits or duties of this class are shown)
    explains the duty symbols and trait colors shown and counts them. The plan then ends above the button (zoomed or not), and the legend opens
    in the row to its right, growing upwards only when that row is too narrow.
  - Arrows jump to the previous/next lesson of any class, skipping weekends, holidays and
    cancelled days. "Stunde zurücksetzen" deletes the selected parts of this lesson's entries.
- **Class editor** (`/classes/new`, `/classes/:id/edit`): a page of its
  own. Changes of an existing class are saved right away (text after a short pause); a new
  class has "Abbrechen" and "Speichern"; leaving it by "Abbrechen", the back button or a link
  to the settings asks first once something was entered. School
  year, half, level and
  letter (both also "Mix"), subject, weekday, lesson, double lesson, an optional second weekly
  lesson on another weekday, and the student list:
  - **WebUntis PDF**: reads last name, first name and photo from all pages (first import and
    later updates). Students are matched per class by first + last name; nickname and traits
    stay, students missing in the file stay in the list. Processed on the device only.
  - **Paste a list**: one student per line, split into first and last name at the first space.
  - **Copy** the students of another class (searchable; without a search it suggests the same
    level this year or the level below last year). The seating plan is copied along if the
    class has none yet.
  - **Student dialog**: first and last name, nickname, photo and traits per student.
  - **Duties**: next to the eye and delete buttons of each student (once duties exist), a
    menu picks one duty for this class or "Kein Dienst"; copied students lose theirs.
  - Nicknames are prefilled: new PDF students with several given names ("Anna-Maria") get the
    first one. Students sharing a given name get as much of the last name as needed ("Anna M.",
    "Anna Mü."), same names are numbered ("Anna 1", "Anna 2").

- **Konto & Sync** (settings tab, off by default): an account with Microsoft or Google
  sign-in keeps several devices in sync, end-to-end encrypted. A recovery key, another device
  or a passkey unlocks the data on a new device. A wizard leads through the required steps;
  an expired sign-in only shows a notice, the app keeps working offline. New accounts
  ask for access (contact email and a short reason) and wait until Mario approves them on the
  server. Details in
  [Settings](#settings).
- **Hints on open points** (`lib/attention.ts`, `hooks/useAttention.ts`): no school year, a
  due backup (`isBackupDue`, also used by the backup reminder) and a sync that needs a step
  or failed put a dot (`components/AttentionDot.tsx`, yellow or red) on the speed dial
  button, on its "Einstellungen" entry and on the settings tab concerned; a running sync
  only pulses the ring of the speed dial button. The settings open on the first tab with an
  open point (fixed at opening).

### Installed app (PWA)

- SQLocal silently falls back to an in-memory database if OPFS fails, for example without
  cross-origin isolation or on a timeout of its storage worker. `rootLoader` detects that,
  retries once by reloading and otherwise blocks the app with `StorageErrorPage`, as all input
  would be lost. It also requests persistent storage.
- The app only runs installed. In a browser tab `/` shows nothing but the install instructions
  (`src/features/install/InstallPage.tsx`) and the database is never opened; only
  `npm run dev` runs in a tab.
- A cold start of the installed app always opens `/#/timetable` without parameters
  (`resetLaunchUrl` in `src/services/pwa.ts`), because iPadOS may keep the URL from the
  moment the app was added instead of the manifest's `start_url`. Reloads keep the current page.
- New versions wait until the user confirms the update banner (or uses "Neu laden"). The app
  checks for updates hourly and whenever it comes back to the foreground.

- **Overview** (`/classes` for the selection, `/classes/:id/table`): one table per class and school year
  half with students in rows (numbered 1 to n from the top, like "Schüler 1", … in the anonymous
  export; the name column is at least as wide as the longest name or traits line), lesson
  dates in columns and the symbols at the intersections.
  The selection groups the classes by school year half, each group ending with a "Neue
  Klasse" tile that presets that half.
  Reachable from the overview selection and from a lesson. Arrows next to the title switch to
  the table of the class with the previous or next lesson in the timetable, as in the seating
  plan. The column of that lesson (`?date=`, else today's or the next one) is
  highlighted and scrolled to the middle when a table or lesson is opened. Its modes are
  *Betrachten* (default, cells do not react), *Bewerten* and *Kommentieren*. The seating plan
  button opens the lesson the table was opened from, else today's or the next one; the speed
  dial holds *Bearbeiten*, *Namen lernen*, the display switches for photos, the traits, which
  are either written out below the names or hidden (photos and traits share their switches
  with the seating plan), and nicknames, and after them the sorting switch (rows sorted by last name,
  shown or not, else by the shown names; exports follow it). Rows and columns are tinted,
  comments are marked with a small symbol, and a long press on a date cancels that lesson. A
  tap on a name covers the entries of all other students and hides all traits, to show a
  student their own.
- **Lesson types**: a lesson can be a *Klausur* (classic marks 1 to 6 with tendencies, plus
  "abwesend", no oral grades) or carry a *Projekt*, a *Nachklausur* or both. They are chosen
  on the date in the overview and in the grading tool bar of the seating plan; a second tap
  removes a type ([src/lib/lessons.ts](src/lib/lessons.ts)). Exam and retake marks are stored
  in `mark`, project marks in `projectMark`, so a lesson keeps its oral grades next to them; in
  the overview each takes its own column (the project before the retake), in the seating plan a switch chooses the mark when a
  retake and a project fall on one day.
  - Follow-ups for students without a mark yet: a *Nachklausur* continues the latest exam, a
    *Projektverlängerung* the latest project (the parts then show as "Projekt 1/2", "Projekt
    2/2", …), each only while that exam or project (with its follow-ups so far) still lacks a
    mark. A student's mark on one date of such a chain closes its other dates for them (grayed
    out with the mark shown faintly, also grayed out in the seating plan), and the mark counts
    as the exam's or project's ([src/lib/lessonChains.ts](src/lib/lessonChains.ts), `createMarkRules`
    shared by seating plan and overview).
  - In a retake lesson only students with their exam mark already get oral grades; those
    writing it get the retake mark (or "abwesend" for it) and no project mark that day.

## Stack

React 19, TypeScript, Vite, VitePWA, SQLocal + Drizzle ORM, MUI (+ MUI X date pickers),
Tailwind CSS 4, React Router (hash routing), date-fns. Encryption and sync use only browser
APIs (WebCrypto, WebAuthn, IndexedDB, fetch, WebSocket); tests run with Vitest.

Sync server ([server/](server/README.md)): Go with SQLite (`modernc.org/sqlite`), passkeys
(`go-webauthn`), Microsoft/Google sign-in (`go-oidc`) and WebSocket. It runs with Docker Compose
on a Raspberry Pi and is reachable through Tailscale Funnel.

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
| `npm run preview`             | serve the production build locally (temporary database)    |
| `npm run lint`                | oxlint                                                     |
| `npm test`                    | Vitest unit tests (`src/**/*.test.ts`, Node, no browser)   |
| `npm run test:e2e`            | end-to-end test of sync against the real Go server (needs Go) |
| `npm run generate-pwa-assets` | render `public/apple-touch-icon.png` from its SVG source   |

SQLocal needs cross-origin isolation. The dev server gets the headers from the SQLocal Vite
plugin; in production `public/_headers` sets `Cross-Origin-Embedder-Policy` and
`Cross-Origin-Opener-Policy` for Cloudflare Pages.

### Sync locally

Without `VITE_SYNC_URL` the build has no sync: turning it on in the settings shows the message
„Für diese Version gibt es keinen Sync-Server.“, the rest of the app works as before. Two ways to work on the sync UI:

- `VITE_SYNC_DEMO=true npm run dev`: the facade (`src/sync/index.ts`) returns sample data, no
  server needed. Normal builds drop the demo.
- Real server (needs Go, see [server/README.md](server/README.md)):

  ```bash
  cd server
  APP_ORIGINS=http://localhost:5173 RP_ID=localhost go run ./cmd/notenfeder-server
  # second terminal, repo root
  VITE_SYNC_URL=http://localhost:8080 npm run dev
  ```

`npm run test:e2e` ([src/sync/e2e.test.ts](src/sync/e2e.test.ts)) builds the server, starts
it with `DEV_AUTH=1` and a temporary data folder, and syncs three simulated devices
(`node:sqlite`) over real HTTP and WebSocket: first upload, recovery key, device link, last
write wins, deletion, photo, offline phase, server restored from a backup, revoked device and
account deletion. CI runs it in its own job.

## Deployment

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): it
builds the app and publishes `dist/` to the Cloudflare Pages project `tablegrade`. The
repository needs the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

The message of the newest commit of a push steers the deployment: `[skip deploy]` deploys
nothing, `[deploy dev]` publishes a preview at `dev.tablegrade.pages.dev` instead of
production (its own origin, so an installed dev app keeps its own data). GitHub's `[skip ci]`
skips all workflows. Run manually, the workflow asks for the target (`production` or `dev`).
The build reads the repository variable `VITE_SYNC_URL` (the server's Tailscale address);
without it the app has no sync.

The sync server deploys on its own: a push to `main` that changes `server/` runs
[.github/workflows/server-image.yml](.github/workflows/server-image.yml), which builds the
image for GHCR; a timer on the Raspberry Pi pulls it. Setup, configuration, backup and
restore: [server/README.md](server/README.md) and
[docs/sync-plan/manual-steps.md](docs/sync-plan/manual-steps.md).

## Project structure

```
src/
├── main.tsx, router.tsx, App.tsx   entry point, routes, root layout (theme, German locale)
├── rootLoader.ts                   settings and storage check for every page
├── theme.ts, index.css             MUI theme and CSS design tokens
├── components/                     shared UI: speed dial (and its entries), page header, mode
│                                   bar, undo/redo, grade tool bar, the frame of a class's sub
│                                   pages, empty states, icons, dialogs
│   ├── brand/                      mascot (raven silhouette), loading nib, startup screen
│   └── help/                       help overlay: component, targets, placement, geometry
├── features/
│   ├── timetable/                  timetable page, grid, backup reminder
│   ├── classroom/                  seating plan page, seat grid, its dialogs
│   ├── classList/                  class selection of the overviews
│   ├── overview/                   overview table with its headers, cells and type menu
│   ├── classEdit/                  class editor page (new class and editing): fields, roster
│                                   list and tools, student dialog
│   ├── nameTrainer/                name cards page
│   ├── settings/                   settings page, one component per topic; `Sync*` views
│                                   of the "Konto & Sync" card
│   ├── install/                    install instructions in a browser tab
│   └── errors/                     404, error page and storage error
├── db/
│   ├── schema.ts                   Drizzle tables and row types
│   ├── migrations.ts               schema of the first release and later SQL migrations
│   ├── client.ts                   SQLocal connection, migrations, import/export
│   └── queries/                    data access per entity
├── services/                       side effects: holiday API, backups, PWA, WebUntis PDF,
│                                   overview export
├── crypto/                         WebCrypto logic of sync: data key, wraps, recovery key,
│                                   record and photo encryption, device link (no DOM, no DB)
├── sync/                           account and sync: facade (`index.ts`, the only entry
│                                   for the UI), API client, sign-in, sync engine (outbox
│                                   push, pull, photos, WebSocket), device store in
│                                   IndexedDB, backup import guard; sample values with
│                                   `VITE_SYNC_DEMO=true`
├── hooks/                          shared state (undo history, display options, stored
│                                   preferences), long press, swipe, settings, going back
├── test/                           test helpers (in-memory `node:sqlite` with all migrations,
│                                   fake sync server, Go server start for `test:e2e`)
└── lib/                            pure helpers: dates, school year, lessons and their mark
                                    rules, seating, grades and grading tools, reports,
                                    warnings, colors, formatters, paths, page memory
public/                             _headers and icons
server/                             sync server (Go, SQLite, Docker on a Raspberry Pi),
                                    see server/README.md
pwa-assets.config.ts                generator config for the PNG home screen icon
```

Routes ([src/lib/paths.ts](src/lib/paths.ts) builds all URLs): `/timetable`, `/classes`
(class selection of the overviews), `/classes/new`, `/classes/:id` (seating plan),
`/classes/:id/table` (overview table), `/classes/:id/edit`, `/classes/:id/names`, `/settings`.
`?date=` selects the week or lesson. Pages with a real way back (editor, name cards,
settings) lead to the page they were opened from ([src/lib/returnPage.ts](src/lib/returnPage.ts)).
Each route has its own loader, pages only reload their data after changes (`useRevalidator`).

State: data lives in SQLite and comes through the loaders. Shared UI state lives in small
stores outside React, read with `useSyncExternalStore`: the undo history across seating plans
and overview tables ([src/hooks/useEditHistory.ts](src/hooks/useEditHistory.ts)) and the
display options shared by both pages
([src/hooks/useDisplayOption.ts](src/hooks/useDisplayOption.ts), kept in local storage).
How the main pages were last shown and which page the settings were opened from is kept in the
session
([src/lib/mainPage.ts](src/lib/mainPage.ts), [src/lib/returnPage.ts](src/lib/returnPage.ts)).
Everything else is local state of its page.

Conventions: components (and their CSS) in PascalCase files with named exports, everything
else in camelCase files; JSDoc on exported functions and components.

## Data model

| Table              | Content                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `Classes`          | recurring lessons: subject, level/letter, school year + half, one or    |
|                    | two weekly lessons (day, hour, double)                                  |
| `Students`         | names, nickname, photo (base64); shared when copied to another class    |
| `Traits`           | student properties with a unique color, edited in the settings          |
| `Students2Traits`  | traits assigned to students                                             |
| `Duties`           | class duties with name, symbol key and color, edited in the settings    |
| `Classes2Students` | class membership, seat (`x`, `y` in half-seat cells) and `dutyId`       |
| `Grades`           | per class, student and date: grade, mark, absent, comment, warnings     |
| `Holidays`         | cached holiday periods, flagged as summer vacation / public holiday     |
| `CancelledDays`    | dates marked as "Ausfall"; nothing is graded on these days              |
| `CancelledLessons` | single lessons (class + date) marked as "Ausfall"                       |
| `LessonTypes`      | lessons that are an exam or carry a project                             |
| `SchoolYears`      | school years in use with the start of their second half                 |
| `Settings`         | app settings as JSON per key                                            |

The SQL table names are kept for compatibility; the TypeScript names differ (e.g.
`schoolClasses`, `classStudents`).
Classes, students, grades, traits and duties have text UUIDs as `id` (since schema version
22), created with `crypto.randomUUID()` on insert, so several devices can add rows without
conflicts. Only `Holidays` keeps integer ids (a cache, never synced).
The internal tables `_sync_state` and `_outbox` (schema version 23) record changed rows for
the coming sync; their triggers only write while sync is enabled (see
[docs/sync-plan/protocol.md](docs/sync-plan/protocol.md)).

### Migrations

[src/db/migrations.ts](src/db/migrations.ts) holds the schema of the first release
(`BASELINE`, schema version `BASELINE_VERSION` = 20, which also the databases and backups
made before keep) and an append-only list of later migrations; the schema version is stored
in `PRAGMA user_version`. An empty database gets the baseline, then every newer migration
runs in its own transaction. To change the schema, append a new entry (never edit an
existing one) and update `schema.ts` accordingly. Migrations run on every connect and after
importing a backup, so older backups of a release are upgraded automatically; backups of
development versions (below 20) or of a newer app version are refused before anything is
replaced. Tests check migrations in Node with `openTestDb` from
[src/test/sqliteDb.ts](src/test/sqliteDb.ts) (`node:sqlite`, Node 22.13 or newer).

### Backup and restore

The settings ("Sicherung") export the database as `notenfeder-YYYY-MM-DD.sqlite3`
through the share sheet on phones and tablets and as a direct download on desktop systems;
PDF and CSV exports are always direct downloads. Importing asks for confirmation, checks the
SQLite file signature and schema version, replaces the database, runs the migrations and
reloads the app. This is
also the way to move data to another device. With sync on, the import turns sync off (see
"Konto & Sync").

## Domain rules

- **Grades** ([src/lib/grades.ts](src/lib/grades.ts)): oral grades and marks use one scale of
  16 numbers (0.7 for "1+", 1, 1.3, 1.7, … 5.3, 6; there is no "6+"); a tendency is worth 0.3. "Excused" is an own flag and
  does not count. Symbols per grade are set in the settings and limited in
  [src/lib/gradeSymbols.ts](src/lib/gradeSymbols.ts): no minus for good, no plus for bad grades.
- **Points**: classes of the levels chosen in the settings (by default EF, Q1, Q2) show all
  grades, marks and report parts as points, 15 ("1+") to 0 ("6"), in the app, the undo
  history and the exports. Only the display changes:
  everything is stored and calculated in marks (`toPoints`, `formatGrade`; the class pages
  provide it through `PointsContext` in [src/hooks/useGradeFormat.ts](src/hooks/useGradeFormat.ts)).
- **Final grade** ([src/lib/assessment.ts](src/lib/assessment.ts)): oral participation is the
  average of all oral grades, the newest counting 1.5 times as much as the oldest. The final
  grade is 50 % exams and 50 % the rest, which is 60 % oral and 40 % projects; a missing part
  leaves its share to the other one. All of these numbers are settings. With too few
  assessments (below 3) the result is "n.b.".
- **Suggestions**: while grading, students without a symbol show the offered grade closest to
  their average before that lesson (3 without any), faded with a dashed ring. Their weights
  rise more steeply than for final grades: oldest once, newest n times.
- **Cancelled lessons** count for nobody, but in the overview single students can still get
  the X there, e.g. for skipping class; it then counts for them.
- **Hidden students** stay in a class with their grades, but only show up in its editor. When
  shown again they get a free seat and "abwesend" for lessons completed in the meantime.
- **New students** added to a class get "abwesend" in all lessons that were complete
  before, so these stay complete; other lessons stay untouched.
- **School years** are added in the settings, each with the start of its second half (no API
  exists for these dates; default February 1st). Possible are 2019/20 up to the latest year whose
  starting summer holidays the API knows, at least the current year + 2. The API lacks the
  summer holidays 2019 (constants in `src/services/holidays.ts`); summer holidays it does not
  know yet are estimated from the latest known ones and replaced once it has them. A school year starts the day after the summer
  holidays, fallback August 1st.
- **Holidays**: fetched per federal state only for the added school years, including both
  summer holidays around them, and cached in the database; offline the cache is used. Changing
  state or years can delete entries outside their lessons, after a double confirmation.
- **Seating**: the room is a 20 × 20 grid of half seats, a student covers 2 × 2 cells (10 × 10
  students). New students get the first free seat of a layout, editable in the settings
  ([src/lib/seating.ts](src/lib/seating.ts)), then any free whole seat.
- **WebUntis PDF** ([src/lib/rosterPdf.ts](src/lib/rosterPdf.ts)): columns are located by the
  header texts `Familienname`, `Vorname` and `Klasse`, rows by the number in the first column.
  Photos are cut from the rendered page at the position of the image in that row.

## Settings

`/settings`: one card per topic, in tabs of related topics below the header, so only one
tab's cards are shown at a time; the tab is kept in the URL (`?tab=`), so a reload or a way
back stays on it, and on the device (local storage), so opening the settings again returns to
the tab used last (or the first tab with an open point). "Konto & Sync" is the first tab and
the default:

- **Schule**: federal state and school years; levels, letters and lessons per day; the
  lesson times (a switch whether the timetable shows them, on by default; while on, the start of
  each lesson between 6:00 and 19:55 in steps of 5 minutes, and one
  length in minutes; by default 8:00, 8:50, 9:55, 10:45, 11:45, 12:35, 13:30 and 14:20 for
  the first eight lessons and 45 minutes), shown below the lesson
  numbers of the timetable.
- **Unterricht**: the mode a lesson opens with and the grade suggestions; the default
  seating plan.
- **Benotung**: symbol per oral grade (also "1+", hidden by default), which grades the bar
  offers and the absent symbol; the levels shown in points (chips of the school's levels);
  the grading shares.
- **Schüler**: traits; duties (symbol, color and name up to 24 characters; colors avoid the
  yellow and red of the warnings; usual duties like "Tafel", "iPad" or "Lüftung/Fenster" are
  offered as suggestions).
- **Darstellung**: theme and light/dark mode; the grade colors, green to red or blue to
  orange for red-green color blindness (`gradePalette`, everywhere in the app and in the PDF
  export, also the correction arrows of reports); a compact overview table (lower rows,
  narrower columns, smaller photos, symbols and marks of exams, projects and reports, through
  the CSS variables `--cell` and
  `--photo` on the table); "Nur Tage und Stunden mit Unterricht": the
  timetable leaves out weekdays without classes and the lessons before the first and after
  the last one of the week (free lessons in between stay; a week without classes stays
  complete).
- **Daten und Export**: backup, restore, backup reminder and "Neu laden"; the PDF export format.
  Tapping the open tab "Daten und Export" seven times unlocks a hidden card *Entwickler* (while
  the settings page stays open): *Mit Beispieldaten füllen* deletes all classes, students, entries, reports,
  cancellations, traits and duties (settings, holidays and school years stay) after a warning,
  an offer to make a backup first, a checkbox and typing "LÖSCHEN", and fills in mock data of
  the current school year half: two subjects (Mathematik, Biologie) in 13 classes filling most of
  the week, made up multicultural names (shared first names get nicknames like "Lea O.", as on
  importing a list), avatars (head and shoulders in varied skin, hair and
  shirt colors), oral grades, absences, warnings, comments, exams with retakes, a project and
  a partial grade, traits and duties. Always the same data
  ([src/lib/mockData.ts](src/lib/mockData.ts), [src/services/mockData.ts](src/services/mockData.ts)).
- **Konto & Sync** (plan and protocol in [docs/sync-plan](docs/sync-plan/README.md)): one card
  whose content follows the sync status (`lib/syncView.ts`): off (explanation and
  "Einrichten"), the setup wizard (`SyncSetupWizard.tsx`, vertical stepper with the required
  steps in order, only the current one open: "Anmelden" with device name and branded buttons
  "Mit Google anmelden"/"Mit Microsoft anmelden" (`OidcButton.tsx`; the first sign-in creates
  the account), "Freischaltung", "Schlüssel" (save the recovery key of a new account or
  unlock this device) and "Daten abgleichen" (consent to replace own local data), then
  active (state, last sync, "Jetzt synchronisieren", sign-in, passkeys, contact) and an
  expired sign-in (the app keeps working locally). An unlocked device that cannot start yet
  (no recovery key, or the consent is missing) has the phase `setupIncomplete`, never a
  green state. A new account first waits for approval (`SyncPending.tsx`, view `pending`, badge
  "Freischaltung offen"): it sends the contact email (suggested from the sign-in) and a reason,
  then shows "Anfrage gesendet" with "Status prüfen" and "Anfrage ändern"; the server refuses
  data until approval (`not_approved`). A server that needs a newer app pauses sync ("Update nötig", "Neu laden"). A
  locked account without a data key on the server is new (`account.hasDataKey`), also after
  a Microsoft or Google sign-up; then the card shows the recovery key once (form that
  password managers offer to save, "Kopieren", "Drucken", "Als Datei speichern", warning that nobody can reset it) and asks for
  two random groups of it (`lib/recoveryKeyCheck.ts`) before going on. The first upload or
  download shows a progress bar in the active view (decrypted records, then photos; photos
  load four at a time; steps without a count, like fetching and writing, show a running bar). A signed-in device
  without the key offers up to three ways to unlock: passkey (only if the account has one that
  can unlock, `account.hasPrfPasskey`), linking with another device (code,
  then comparing the check code) and typing the recovery key (password managers can fill it).
  After unlocking, school data already on the device needs consent before the account's data
  replaces it ("Daten ersetzen" or "Abbrechen"; merging is not possible).
  The active view (`SyncActive.tsx`) starts with the state (colored dot, last sync, open
  changes, "Jetzt synchronisieren", progress) and then titled blocks (`SyncBlock.tsx`):
  "Konto" ("Angemeldet mit Google als <email>", `SyncSignedIn.tsx`; the email comes from the
  sign-in of this device and stays on it; contact email with "Ändern", `SyncContact.tsx`),
  "Geräte" ("Geräte anzeigen" lists the devices with their last activity, renames them
  (pencil) and revokes another one after a confirmation; "Gerät koppeln" enters the code of a
  new device), "Entsperren & Wiederherstellung" (passkey hint or state with "Passkey
  hinzufügen", `SyncPasskeys.tsx`; "Neuer Wiederherstellungsschlüssel", same steps, the old
  one stops working) and "Abmelden & Löschen" ("Abmelden", "Synchronisierung ausschalten",
  "Konto löschen": type „LÖSCHEN“, optionally also delete the school data on this device).
  An account has exactly one sign-in method; there is no linking of a second one. Passkeys
  never sign in or create an account; one without PRF is refused with a hint before the
  server learns about it (Windows Hello often lacks PRF; the Google Password Manager has it).
  Unlocking asks for a passkey without a credential list, so Chrome on Windows offers its own
  passkeys instead of handing over to Windows Hello; a passkey without wrap is refused. Every
  passkey request names the server's relying party id (`rpId` from `GET /auth/session` or the
  registration options), so the dev preview on a subdomain finds the passkeys too. If the
  authenticator already holds a passkey of the account, "Passkey hinzufügen" lets the user
  pick it and sets it up for unlocking instead.
  The sync state (`getSyncBadge` in `lib/syncView.ts`) feeds the hints on open points (see
  above); an expired sign-in or a needed update also shows a closable
  notice on every other page (`components/SyncNoticeBanner.tsx`). There is no lock screen.
  Importing a backup while sync is on turns sync off (`sync/importGuard.ts`), so the old data
  cannot overwrite the other devices. The notice and the card then say so
  (`components/SyncImportNotice.tsx`) until "Verstanden" hides it (`dismissImportNotice`).
  The explainable elements of the card, the dots and the notice have `data-help` texts, so *Hilfe*
  explains them. The card's views are small components in `features/settings/Sync*.tsx`;
  `useSyncAction` runs a facade call and shows its German error (`SyncErrorAlert`).

They are stored as JSON in the `Settings` table
([src/lib/settings.ts](src/lib/settings.ts)), so backups include them. A PIN lock exists, but stays
hidden (`PIN_LOCK_ENABLED`) until accounts allow resetting a forgotten PIN.

## Partial and half year grades

A tap on a date in the overview adds a *Teilnote* or *Halbjahresnote* behind that lesson; they
are independent of the lesson type and a partial grade comes first on a shared day. A report covers the
entries after the previous report: read-only columns show the rounded parts (*Mündlich*,
*Projekte*, *Klausuren*, only those that exist), the main column *Gesamt* the calculated grade (rounded to the closest grade; only a value
exactly in the middle at two decimals, like 2,85, goes to the better one) with tendency
by the rules in [src/lib/assessment.ts](src/lib/assessment.ts). Marks set on the main column in the
grading mode replace it, with an arrow towards the correction (a yellow "!" where "n.b." was
replaced); deleting brings the calculation
back. The grade suggestions for lessons still use all entries.

A half without partials works like a partial grade. With at least two partials it lists them and suggests
their average instead; there is one half per class, and exactly one partial before it is not
allowed. Reports are calculated live in [src/lib/reports.ts](src/lib/reports.ts), only the
corrections are stored.

## Export

The corner of the overview table exports it as CSV or PDF. Projects get two columns, one for
oral grades and one for marks, here and in the app, and reports their columns. Theme colors are never exported; grade and
trait colors and symbols or numbers are settings. PDFs contain photos and written out traits as
the overview shows them (never the trait dots), unless the settings exclude them; CSV files only
contain names and grade values. *Als CSV, anonymisiert* numbers the students ("Schüler 1", …)
in the order of the table and puts the lesson's comment after the grade ("2-, Kommentar",
in the lesson's first column); names of the class's students in comments (first, last and
nicknames, whole words, any case) become their numbers. Notes above the table state the
order (by last name, nickname or first name, as sorted), asking anyone evaluating the file,
an AI included, to mention it in every answer. Class and subject are left out of the file and its name
(`Uebersicht-anonym-<date>.csv`). PDFs are built with jsPDF in
[src/services/overviewExport.ts](src/services/overviewExport.ts).

## Styling

Colors come from the themes in [src/lib/themes.ts](src/lib/themes.ts), each with a derived dark
mode. `useAppTheme` writes them as CSS variables over the defaults of
[src/index.css](src/index.css) and builds the MUI theme from them. MUI styles are placed in the CSS layer
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

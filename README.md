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

- **Speed dial** (top right, [src/components/SpeedDial.tsx](src/components/SpeedDial.tsx)):
  collapsed it only shows *Hilfe*, the caret opening it and, on the pages of a class, buttons
  to its other pages (seating plan or overview table, labelled in landscape), which never
  cover the page (only the calendar card a bit); open it lists all further features of the page with their
  labels on the left, above everything else. Display options are real switches, and
  *Einstellungen* is always the last entry. Modes are no part of it: classroom and overview
  table choose them with small text toggle buttons in the top left corner of the bar below the
  header, with undo/redo in its top right corner and the mode's hint or grading tools below.
  - *Hilfe* explains everything on the screen at once: each element with a `data-help` text
    gets a callout connected to it by a line ([src/components/HelpOverlay.tsx](src/components/HelpOverlay.tsx)),
    placed so it covers neither the explained elements nor other callouts.
    With the dial collapsed it explains the page, open only the dial itself. Large areas like
    the seating plan cannot be avoided, they get their callout inside; a tap anywhere closes it.
  - At the top left the seating plan always leads back to "Stundenplan" (in the week of the
    lesson) and the overview table to "Übersichten" ([src/lib/mainPage.ts](src/lib/mainPage.ts)
    keeps how they were last shown). The overview selection always leads back to the timetable,
    in the week last shown; settings, class editor and name cards go one real step back
    and name the page they came from ([src/lib/returnPage.ts](src/lib/returnPage.ts)); editor
    and name cards are pages of their own (`…/edit`, `…/names`) whose speed dial only holds the
    help and the settings.
  - Seating plans and overview tables share one undo/redo across their modes and pages, shown
    as two pills with the step's mode and description. A step made on another page first
    opens that page (the page change itself is no step); the main pages end the history. Each
    step is named after its mode (*Ermahnung*, *Bewertung*,
    *Kommentar*, *Anordnung*) and describes the student and value
    ([src/hooks/useEditHistory.ts](src/hooks/useEditHistory.ts)).
- **Timetable** (`/timetable`): week picker (Monday–Friday only) and the timetable of the
  selected week, one row per lesson.
  - Lessons are colored tiles: the subject sets the hue, the level the shade (5 light, Q2
    dark); double lessons span two rows.
  - Lesson-free hours show `FREI` with dashed slots that create a new class for that slot;
    vacations show `FERIEN`, public holidays `FEIERTAG`.
  - Long press on a day header or a lesson marks it as `AUSFALL` (illness, bridge day, …) or
    makes it regular again. Existing entries must be confirmed and are then deleted.
  - Complete lessons (every student has a symbol) show a check mark, here and in the classroom.
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
    switches for zoom, photos and traits.
  - *Ermahnen*: each tap cycles a student through yellow → red → none.
  - *Bewerten*: the tool bar (grade symbols, "entschuldigt", suggestion, delete, lesson type)
    stays open below the header; tapping a student applies the tool. The suggestion is the
    default tool; without previous grades it suggests the shown symbol closest to a plain 3,
    the better one of two equally close.
  - *Kommentieren*: the only place for comments. Speech bubbles show their first words, a tap
    edits the comment or starts a new one.
  - *Anordnen*: drag students to whole or half seats; dropping onto a student swaps both.
  - "Zoom" zooms in on the smallest part of the room holding
    all seated students. The seats get larger, not the text, so longer names and larger photos
    fit; both directions grow alike, so seats keep their shape. The choice is kept per device;
    arranging always shows the whole room.
  - Seats show the photo with one colored dot per trait around it (fixed slot per trait,
    colors in the settings); "Legende" in the bottom left corner (while the traits are shown) explains the colors of this class
    and counts them.
  - Arrows jump to the previous/next lesson of any class, skipping weekends, holidays and
    cancelled days. "Stunde zurücksetzen" deletes the selected parts of this lesson's entries.
- **Class editor** (`/classes/new`, `/classes/:id/edit`, `/overview/:id/edit`): a page of its
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
  - Nicknames are prefilled: new PDF students with several given names ("Anna-Maria") get the
    first one. Students sharing a given name get as much of the last name as needed ("Anna M.",
    "Anna Mü."), same names are numbered ("Anna 1", "Anna 2").

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

- **Overview** (`/overview`, `/overview/:id`): one table per class and school year
  half with students in rows, lesson dates in columns and the symbols at the intersections.
  The selection groups the classes by school year half, each group ending with a "Neue
  Klasse" tile that presets that half.
  Reachable from the overview selection and from a lesson. Arrows next to the title switch to
  the table of the class with the previous or next lesson in the timetable, as in the seating
  plan. The column of that lesson (`?date=`, else today's or the next one) is
  highlighted and scrolled to the middle when a table or lesson is opened. Its modes are
  *Betrachten* (default, cells do not react), *Bewerten* and *Kommentieren*. The seating plan
  button opens the lesson the table was opened from, else today's or the next one; the speed
  dial holds *Bearbeiten*, *Namen lernen* and switches for photos, nicknames and the traits,
  which are either written out below the names or hidden (photos and traits share their
  switches with the seating plan). Rows and columns are tinted,
  comments are marked with a small symbol, and a long press on a date cancels that lesson. A
  tap on a name covers the entries of all other students, to show a student their own.
- **Exams and projects**: in the grading mode a lesson can become a *Klausur* (classic marks 1
  to 6 with tendencies instead of symbols, plus "entschuldigt") or a *Projekt* (symbols and
  marks). In the overview a tap on a date sets this for the column; marks only appear in its tool
  bar once a column is an exam or project.

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
| `npm run preview`             | serve the production build locally (temporary database)    |
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
├── rootLoader.ts                   settings and storage check for every page
├── theme.ts, index.css             MUI theme and CSS design tokens
├── components/                     shared UI: speed dial, help, mode bar, undo/redo, grade
│                                   tool bar, the frame of a class's sub pages, icons, dialogs
├── features/
│   ├── timetable/                  timetable page, grid, backup reminder
│   ├── classroom/                  seating plan page, seat grid, its dialogs
│   ├── overview/                   class selection and overview table
│   ├── classEdit/                  class editor page (new class and editing), student dialog
│   ├── nameTrainer/                name cards page
│   ├── settings/                   settings page, one component per topic
│   ├── install/                    install instructions in a browser tab
│   └── errors/                     404, error page and storage error
├── db/
│   ├── schema.ts                   Drizzle tables and row types
│   ├── migrations.ts               ordered SQL migrations
│   ├── client.ts                   SQLocal connection, migrations, import/export
│   └── queries/                    data access per entity
├── services/                       holiday API, backups, PWA, WebUntis PDF, overview export
├── hooks/                          shared state (undo history, display options, stored
│                                   preferences), long press, swipe, settings
└── lib/                            pure helpers: dates, school year, lessons, seating,
                                    grades, reports, warnings, colors, formatters, page memory
public/                             _headers and icons
pwa-assets.config.ts                generator config for the PNG home screen icon
```

Routes: `/timetable`, `/overview` (selection), `/overview/:id` (table), `/classes/:id`
(seating plan), `/classes/new`, `/settings`. Editor and name cards exist under both class
prefixes (`/classes/:id/edit`, `/overview/:id/edit`, `…/names`) as the same page components;
the prefix only decides the way back. Each route has its own loader, pages only reload their
data after changes (`useRevalidator`).

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
| `Classes2Students` | class membership and seat (`x`, `y` in half-seat cells)                 |
| `Grades`           | per class, student and date: grade, mark, absent, comment, warnings     |
| `Holidays`         | cached holiday periods, flagged as summer vacation / public holiday     |
| `CancelledDays`    | dates marked as "Ausfall"; nothing is graded on these days              |
| `CancelledLessons` | single lessons (class + date) marked as "Ausfall"                       |
| `LessonTypes`      | lessons that are an exam or carry a project                             |
| `SchoolYears`      | school years in use with the start of their second half                 |
| `Settings`         | app settings as JSON per key                                            |

The SQL table names are kept for compatibility; the TypeScript names differ (e.g.
`schoolClasses`, `classStudents`).

### Migrations

[src/db/migrations.ts](src/db/migrations.ts) is an append-only list; the number of applied
migrations is stored in `PRAGMA user_version`. To change the schema, append a new entry
(never edit an existing one) and update `schema.ts` accordingly. Migrations run on every
connect and after importing a backup, so older backups are upgraded automatically.

### Backup and restore

The settings ("Sicherung") export the database as `tablegrade-YYYY-MM-DD.sqlite3`
through the share sheet on phones and tablets and as a direct download on desktop systems;
PDF and CSV exports are always direct downloads. Importing checks the SQLite file signature, asks
for confirmation, replaces the database, runs the migrations and reloads the app. This is
also the way to move data to another device.

## Domain rules

- **Grades** ([src/lib/grades.ts](src/lib/grades.ts)): oral grades and marks use one scale of
  16 numbers (1, 1.3, 1.7, … 5.7, 6); a tendency is worth 0.3. "Excused" is an own flag and
  does not count. Symbols per grade are set in the settings and limited in
  [src/lib/gradeSymbols.ts](src/lib/gradeSymbols.ts): no minus for good, no plus for bad grades.
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
  shown again they get a free seat and "entschuldigt" for lessons completed in the meantime.
- **New students** added to a class get "entschuldigt" in all lessons that were complete
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

`/settings`: federal state and school years, theme and light/dark mode, symbols per
grade, grading shares, traits, levels, letters and lessons per day, default seating plan,
backup, restore, backup reminder, "Neu laden" and the export format. They are stored as JSON in the `Settings` table
([src/lib/settings.ts](src/lib/settings.ts)), so backups include them. A PIN lock exists, but stays
hidden (`PIN_LOCK_ENABLED`) until accounts allow resetting a forgotten PIN.

## Partial and half year grades

A tap on a date in the overview adds a *Teilnote* or *Halbjahresnote* behind that lesson; they
are independent of the lesson type and a partial grade comes first on a shared day. A report covers the
entries after the previous report: read-only columns show the rounded parts (*Mündlich*,
*Projekte*, *Klausuren*, only those that exist), the main column *Gesamt* the calculated grade (rounded to the closest grade; only a value
exactly in the middle at two decimals, like 2,85, goes to the better one) with tendency
by the rules in [src/lib/assessment.ts](src/lib/assessment.ts). Marks set on the main column in the
grading mode replace it, with an arrow towards the correction; deleting brings the calculation
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
contain names and grade values. PDFs are built with jsPDF in
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

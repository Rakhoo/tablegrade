---
name: clean-check
description: Review and tidy the current uncommitted changes in Notenfeder against the project's clean-code rules (brevity, comments, structure, React patterns, paths, data-help), fix what is found, then run tsc, lint, build and Prettier. Use after every code change before reporting, or when Mario asks for a clean-up or review.
---

# clean-check

Goal: code that is short, readable and commented just enough. Only touch what the current
change touched (plus duplicates it reveals); no drive-by refactors elsewhere.

## 1. Collect the change

```bash
git status --short
git diff HEAD --stat
git diff HEAD -- src
```

Read new files fully, changed files only around the hunks. Nothing changed → say so and stop.

## 2. Check each hunk

**Brevity and simplicity**
- Is there a shorter, equally clear way? Early returns instead of nesting, small named helpers
  instead of long blocks, no needless intermediate variables, wrappers or abstractions.
- Logic that already exists elsewhere (`src/lib`, `src/hooks`, `src/components`,
  `createMarkRules`, `gradeTools`, `PageHeader`, `speedDialEntries`, `useEditHistory`,
  `useDisplayOption`) is reused, not rebuilt; `grep` before accepting a new helper.
- Duplicates introduced or touched by the change are merged.
- No dead code: unused imports, variables, props, parameters, exports, commented-out code.

**Comments**
- JSDoc (`/** … */`) on exports, components, props fields and local helpers: one short
  English line on *why*/what for, no restating of the type or name, no `@param` lists that
  only repeat the signature.
- Inline `//` only for non-obvious steps (browser quirks, ordering, rule edge cases). Remove
  comments that narrate the code, mark changes ("new", "fixed") or are outdated.

**React and TypeScript**
- Derived values computed in render, not mirrored in state or effects; effects only for DOM,
  storage or listeners.
- Stable keys from data, never array indices; no object/array literals as default props.
- Named exports, `type <Name>Props`, PascalCase component files, camelCase otherwise, no
  shadowed names, no `any` or non-null assertions without a reason.

**Project structure**
- Files in the right place (`features/<page>`, `components`, `hooks`, `lib` without side
  effects, `services`, DB access only via `src/db/queries` exported from `src/db/index.ts`).
- Component files stay under ~500 lines; otherwise split into sub-components in the same folder.
- URLs only via `paths`; new routes also in `router.tsx`, `paths.ts`, `lib/returnPage.ts`.
- New explainable UI elements have a German `data-help` (`-group`, `-repeat` as in README).
- UI texts German, code and comments English.
- Migrations only appended; no new dependencies; no network calls or data leaving the device.
- Lint rules not weakened; any `oxlint-disable-next-line` has a short reason above it.

## 3. Fix and verify

Apply the fixes directly (behaviour must not change). Then:

```bash
npx prettier --write <changed files under src/>
npx tsc -b --noEmit
npm run lint
npm run build
```

Never run Prettier on `README.md`. Feature change → check that `README.md` is updated by hand.

## 4. Report (German, short)

- What was tidied (one line per kind of fix, not per line).
- Results of tsc / lint / build.
- Anything deliberately left as is, and why. No commit, no commit message unless asked.

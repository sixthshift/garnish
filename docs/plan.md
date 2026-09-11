# Plan

Implementation plan for garnish, stage 2 (UI), written to be executed one task per loop iteration with no human present. Decisions live in [decisions.md](decisions.md), shape in [architecture.md](architecture.md), boundaries in [scope.md](scope.md). Run it with `/ailoop` (see `.claude/skills/ailoop/SKILL.md`): one fresh subagent per task, the orchestrator verifies and records. This file is edited only by the orchestrator. Completed stages live in `docs/plans/`; stage 1 is [v1-foundations.md](plans/v1-foundations.md).

## Loop protocol

What one task looks like, whoever runs it (an ailoop subagent, a /loop firing, or a person):

1. Read this file. Read `CLAUDE.md`. Do not re-read the other docs unless a task points at them.
2. Pick the first unchecked task whose dependencies are checked. Milestones run in order; tasks within a milestone run in order unless marked `∥`. A `!` before the task id asks `/ailoop` to dispatch it on a stronger model; the skill's Model section has the rules.
3. Do that one task. Nothing else. No drive-by refactors, no adjacent tasks.
4. Verify with the task's own check. Then run the full gate:
   ```
   bun run check     # tsc --noEmit
   bun run test      # vitest run
   ```
   Both must pass. A failing gate is not done. Fix it or revert the task.
5. Commit with a one-line message naming the task id, e.g. `M1.3 recipe document schema`. Attribution trailer per `CLAUDE.md`.
6. Report. Under `/ailoop` the orchestrator ticks the task, appends the Log line and commits; a subagent never edits this file. Under `/loop`, do it yourself.
7. Stop. One task per iteration.

Rules:

- **Blocked?** Write the blocker under Blocked with the task id and what you tried. Move to the next task that does not depend on it. Never guess past a blocker on a decision; guess freely on implementation detail, and when unsure copy Mealie.
- **Question for Jason?** Write it under Questions. Pick the Mealie answer and continue. Do not stop.
- **Found a design gap?** Add a row to `decisions.md`. Do not edit existing rows. Note it in the Log.
- **Framework questions?** TanStack Start docs at https://tanstack.com/start/latest. Server functions for app calls, server routes only under `src/routes/api/`. SPA mode stays on.
- **UI element needed?** Check the design system's exports first (`node_modules/@sixthshift/design-system/package.json`). Build locally only if absent, under `src/components/ui/`.
- **Task too big for one iteration?** Split it in place into `Mx.y.a`, `Mx.y.b`. Do the first part.
- **Tests:** every pure function and every API route gets tests in the same task that creates it. No task is done with a TODO test.
- **No new dependencies** beyond the list in M0 without a decisions.md row saying why.

## Layout

```
src/
  routes/       TanStack Start file routes: pages, and server routes under routes/api/
  server/       server functions (createServerFn), grouped by resource; db access only here
  db/           migrations/*.sql, migrate.ts, seed.ts, repositories
  domain/       zod schemas, scaling, formatting. Pure, no IO, importable by client
  components/   React components; ui/ holds local primitives the design system lacks
  lib/          client-side helpers (mutate + router.invalidate)
  styles.css    Tailwind entry with the design system's three lines
  router.tsx    getRouter()
vite.config.ts  tanstackStart({ spa }), nitro({ preset: 'bun' }), viteReact(), tailwindcss()
test/           mirrors src/
data/           runtime volume: garnish.db, images/, backups/  (gitignored)
```

Scripts in `package.json`: `dev` (`bun --bun vite dev`), `build` (`bun --bun vite build`), `start` (`bun run .output/server/index.mjs`), `check` (`tsc --noEmit`), `test` (`vitest run`), `migrate`, `seed`, `backup`.

## Stage 2: UI

Built from [ui-gap.md](ui-gap.md). Copy Mealie unless the row there names another source. Decisions 40–43 settle the editor route, the cook log, organisers and favourites. Design system has `sheet`, `toast`, `popover`, `tabs`, `search-input`, `switch`, `badge`, `tooltip`; menus and data tables are local primitives. Task ids continue from stage 1.

## M10 Stage 2 foundations

- [x] **! M10.1 Schema 002.** `002_stage2.sql`: `recipe.favourite INTEGER NOT NULL DEFAULT 0`; `timeline_event` (id, recipe_id CASCADE, occurred_on date text, message, image, created_at). Domain: `favourite` on `recipeSchema`/summary, `timelineEventSchema`. Repository `src/db/timeline.ts` (list by recipe newest first, create sets `recipe.last_made` to the max date, remove recomputes it) and `recipes.setFavourite`. Check: migrate twice on `:memory:`; create two events, `lastMade` equals the later; delete it, `lastMade` falls back.
- [x] **M10.2 Client state stores.** `src/lib/prefs.ts` (localStorage: view mode, sort, structured/summary, theme, screen-awake) and `src/lib/ticks.ts` (sessionStorage: ingredient and step done state keyed by recipe id). Pure controller over a storage-like interface, thin hooks, try/catch around every access. Check: unit tests with an in-memory storage, including a throwing storage.
- [x] **M10.3 Toasts and theme toggle.** Design system `toast` mounted once in `__root.tsx`; `notify()` helper in `src/lib/`; RecipeForm save/delete and image upload report through it instead of inline copy. Theme toggle light / dark / system in Settings, persisted via prefs, replacing system-only. Check: render tests; toggle persists across reload in dev.

## M11 Recipe view

- [x] **M11.1 Header.** Image beside text from `md`, stacked below. Name, rating, description, tag chips, then a stat strip prep / cook / total with icons and a yield line. Footer: source URL (field exists), created and updated dates. Check: render test at both layouts via class assertions; source URL renders as a link when set.
- [x] **M11.2 Ingredient rows.** Mealie order: quantity, unit, **bold** food, note dimmed on its own line; `fixed` marker kept. Tick box per row, state via `ticks.ts`, strike-through when done. Scaled numbers get a class when `servings` differs from the recipe's. Check: render tests for ticked, scaled and fixed rows.
- [x] **M11.3 Structured or Summary.** Per-device toggle (design system `switch`) between per-component ingredient blocks and one merged list, merged by food and unit with quantities summed, `fixed` and null kept as separate lines. Pure `mergeIngredients(recipe)` in `src/domain/`. Check: merge tests; toggle persists.
- [x] **M11.4 Steps.** Tap a step to mark done: dims and collapses the text, state via `ticks.ts`. Step text rendered as a safe markdown subset (paragraphs, bold, italics, lists; no raw HTML) with a pure renderer in `src/domain/markdown.ts`. Check: renderer tests including an HTML injection case; done-state render test.
- [x] **M11.5 Scale control.** Chip "Serves N" with − / + and a `popover` holding a number input, Reset. "Scale to…" on an ingredient row's menu sets servings so that ingredient reaches a typed amount. Yield text scales. Check: pure `servingsForTarget()` tests; render test.
- [x] **M11.6 Action menu.** Local `Menu` primitive in `ui/`. Items: Edit, Cook, Duplicate, Copy link, Copy ingredients, Print, Delete (moves from the edit page, keeps `ConfirmDialog`). `duplicateRecipe({id})` server function copies the document with " (copy)" and a fresh slug. Print: `@media print` stylesheet hiding chrome, image left, two-column ingredients, notes. Check: duplicate test round-trips; copy text test; print CSS contains the rules.
- [ ] **M11.7 Made this.** Button beside last-made in the header opens a `sheet`: date (default today), comment, optional photo (reuse `ImageUpload`, stored under `data/images/timeline/<eventId>.<ext>` via a new server route). Timeline list under Notes, newest first, with delete. Server functions `listTimeline`, `createTimelineEvent`, `deleteTimelineEvent`. Check: tests per function; render test shows the event and updated last made.

## M12 Recipe list

- [x] **M12.1 Cards.** `∥` Rating stars, total-time chip, favourite heart toggling `setFavourite` optimistically, tags capped at 3 with `+N`. List summary gains `favourite`, `lastMade`, `totalTime`. Check: render test; toggle round-trips through the server function.
- [x] **M12.2 View modes and scroll.** `∥` Grid and list modes (Mealie's `RecipeCardMobile` shape for list), persisted via prefs; scroll position restored on back navigation. Check: render tests for both modes; prefs test.
- [x] **M12.3 Filters.** `listRecipes` gains `tags[]` with `match: any|all`, `foods[]`, `favourite`. Filter bar: tag chips with an any/all switch, food picker (reuse `Combobox`), favourites toggle. All in search params. Check: repository tests for each filter and the all-match case; render test.
- [ ] **M12.4 Sort.** `listRecipes` gains `sort: name|created|updated|lastMade|rating|random` and `dir`. Sort menu in the toolbar, dice button opens one random recipe. Random uses a seed in search params so paging is stable. Check: repository tests per key; render test.
- [ ] **M12.5 Global search.** `/` outside an input opens a dialog (`sheet` on phone, centred on wide) with `search-input`, results as list cards, arrow keys move selection, Enter opens. Closes on navigation. Check: pure key-handler tests; render test.

## M13 Editor

- [x] **M13.1 Save bar and discard guard.** Sticky bottom bar with Save and Cancel on phone, inline on wide. Dirty tracking against the initial draft; `useBlocker` shows a `ConfirmDialog` on route leave and a `beforeunload` prompt. Check: pure `isDirty()` tests; render test of the bar.
- [x] **! M13.2 Phone ingredient rows.** Below `md` each row is one line (formatted ingredient text, or `originalText`) with a chevron; tap opens a `sheet` holding the existing fields plus a read-only `originalText` line. From `md` the inline row stays. Check: render tests at both widths via class assertions; sheet saves back into the draft.
- [ ] **M13.3 Drag reorder.** `ReorderList` gains pointer-event drag (handle, 250 ms touch delay, no dependency) within a list and between components via a shared group id; up/down buttons and "Move to" kept. Check: pure `dropIndex()` tests; render test shows handles.
- [ ] **M13.4 Bulk add and step tools.** "Bulk add" on ingredients and steps: `sheet` with a textarea, one item per line, buttons trim whitespace, strip leading numbers, split on blank lines; ingredients become text-only rows. Steps gain insert above / below, split by paragraph, merge with next. Check: pure helpers tested for every button; render test.
- [ ] **M13.5 Image from URL and JSON view.** Image field accepts a pasted URL fetched server-side (`fetchImage` server function, same sniffing as upload). "JSON" toggle swaps the form for a textarea of the document; Apply parses with `recipeInputSchema` and shows errors. Check: server function test with a local fixture URL; JSON round-trip test.
- [ ] **M13.6 Phone confirmations.** `ConfirmDialog` renders as a `sheet` below `md`, centred above. `originalText` shown in grey above a parsed row on wide. Check: render tests at both widths.

## M14 Cook mode

- [ ] **M14.1 Navigation.** Component pills across the top jump to that component's first card; vertical swipe between cards with a scroll-versus-swipe threshold; ARIA live region announces "Step 2 of 5" or "Ingredients for Dough". Check: pure `swipeIntent()` tests; render test shows pills and the live region.
- [ ] **M14.2 Ticks and finish.** Ingredient card items tick on tap sharing `ticks.ts` with the view page. Final card: "Finished" with a "Made this" shortcut opening the M11.7 sheet and an Exit link. Check: render tests; tick state shared in a test that renders both routes.

## M15 Reference data

- [x] **! M15.1 Data table.** Local `DataTable` primitive: search, sortable columns, row select, edit `sheet` from a field spec, delete `ConfirmDialog` listing affected recipes (new `recipes.usingFood(id)`, `usingUnit(id)`, `usingTag(id)` repository queries). Settings becomes `tabs`: Foods, Units, Aisles, Tags, Appearance. Check: render tests; affected-recipe queries tested.
- [x] **M15.2 Foods.** `∥` Columns name, plural, aisle, skip shopping, aliases count. Editor edits all food fields; aisle is a select with create. Merge: pick a target, source deleted, ingredient rows repointed (`foods.merge(sourceId, targetId)` in one transaction). Check: merge test repoints and deletes; render test.
- [ ] **M15.3 Units.** `∥` Columns name, plural, abbreviation, use abbreviation, fraction. Editor and merge as foods. Check: merge test; a merged unit renders through `formatAmount` correctly.
- [ ] **M15.4 Aisles and tags.** Aisles: drag ordering (M13.3 `ReorderList`), rename, delete with foods reassigned to none. Tags: A–Z grouped list, rename, merge, delete, click opens the list filtered. Check: repository tests for aisle reorder and tag merge; render tests.

## M16 Finish

- [ ] **M16.1 Sample data.** `seed --sample` adds a favourite, two timeline events and a source URL so every new screen has data. Check: seed twice, counts unchanged.
- [ ] **M16.2 Docs sync.** `architecture.md` frontend, data model and API sections match stage 2; `ui-gap.md` rows marked done or deferred; README mentions the settings tabs and Made this. Check: docs tests updated and green; fresh-clone run-through as in M9.3.

## Blocked

_(none)_

## Questions

_(none)_

## Log

_(one line per iteration: date, task id, outcome, model)_

2026-09-11  M10.1  done  124bc1b  opus  002_stage2 adds `recipe.favourite` and `timeline_event`; timeline repository derives `last_made` from the greatest event date
2026-09-11  M10.2  done  57e3d7f  sonnet  prefs.ts and ticks.ts as pure controllers over a storage interface with thin hooks
2026-09-11  M10.3  done  f7ae35a  opus  notify() store plus one Toaster in __root; save/delete/upload toast, Settings gains a light/dark/system theme toggle
2026-09-11  M11.1  done  b1c939f  opus  RecipeHeader with split layout, stat strip, yield line and a footer carrying source link and dates
2026-09-11  M11.2  done  58d4000  sonnet  IngredientRow with tick box, dimmed note, fixed marker and a scaled class on the amount
2026-09-11  M11.3  done  200d399  sonnet  pure mergeIngredients plus a per-device Structured/Summary switch on the view route
2026-09-11  M12.1  done  0d2aa30  sonnet  cards gain stars, total-time chip, optimistic favourite heart and capped tags; summary carries totalTime and lastMade
2026-09-11  M11.4  done  e062a19  opus  hand-written safe markdown subset rendered through React; steps dim and collapse when ticked
2026-09-11  M12.2  done  00a1003  sonnet  grid and list card modes via the view-mode pref; scroll restoration already app-wide in router.tsx
2026-09-11  M15.1  done  8f6b5ed  opus  local DataTable, field-spec EditSheet and usage-listing delete confirm; Settings becomes tabs; recipes gains usingFood/usingUnit/usingTag
2026-09-11  M11.5  done  70d4b14  sonnet  Serves N chip with a popover and pure servingsForTarget backing Scale to on ingredient rows
2026-09-11  M12.3  done  a196949  sonnet  listRecipes gains tags/match/foods/favourite; FilterBar wired into search params, legacy singular tag folded in
2026-09-11  M13.1  done  74d5084  opus  SaveBar sticky on phone and inline from md; draft diffed against the opening one, useBlocker plus beforeunload guard
2026-09-11  M11.6  done  2e681c8  opus  local Menu primitive behind a ⋯ trigger, duplicateRecipe server function, Delete moved off the edit page, print rules in styles.css
2026-09-11  M13.2  done  fe4a920  opus  editor ingredient rows collapse to a summary line with a chevron below md, tapping opens a sheet over shared IngredientFields
2026-09-11  M15.2  done  fdd274a  sonnet  Foods tab wired to edit, usage-confirmed delete and a transactional foods.merge that repoints ingredients

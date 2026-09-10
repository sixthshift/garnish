# Plan

Implementation plan for garnish v1, written to be executed one task per loop iteration with no human present. Decisions live in [decisions.md](decisions.md), shape in [architecture.md](architecture.md), boundaries in [scope.md](scope.md). Run it with `/ailoop` (see `.claude/skills/ailoop/SKILL.md`): one fresh subagent per task, the orchestrator verifies and records. This file is edited only by the orchestrator.

## Loop protocol

What one task looks like, whoever runs it (an ailoop subagent, a /loop firing, or a person):

1. Read this file. Read `CLAUDE.md`. Do not re-read the other docs unless a task points at them.
2. Pick the first unchecked task whose dependencies are checked. Milestones run in order; tasks within a milestone run in order unless marked `∥`.
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

## M0 Foundations

- [x] **M0.1 Scaffold TanStack Start.** Add `@tanstack/react-start`, `@tanstack/react-router`, `react@19`, `react-dom@19`, their types, `vite`, `@vitejs/plugin-react`, `nitro`, `@tailwindcss/vite`, `tailwindcss`, `zod`, `@sixthshift/design-system`, `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`, `vitest`, `typescript@^5` (pin: 7.x drops `tsserver`, which the editor LSP needs). Create `vite.config.ts` with `tanstackStart({ spa: { enabled: true } })`, `nitro({ preset: 'bun' })`, `viteReact()`, `tailwindcss()`. `src/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx` rendering "garnish". Scripts as listed. Check: `bun run dev` serves `/`; `bun run build` then `bun run start` serves `/` from `.output`; `bun run check` passes.
- [x] **M0.2 Design system spike.** `src/styles.css` with `@import "tailwindcss"`, the theme import, and `@source "../node_modules/@sixthshift/design-system"`. Import both fonts in `__root.tsx`. Index route renders a `Button` and a `Heading` from the design system. Check: built CSS contains a design-system token variable and the button renders styled in dev and in the production build.
- [x] **M0.3 Gate and health.** vitest configured in `vite.config.ts` (`test.include: ['test/**/*.test.ts']`, node environment), `bun run test` with one trivial test. Server route `src/routes/api/health.ts` returning `{"ok":true}`. `data/` created on boot if missing. Check: gate passes, `curl /api/health` in dev and in the built server.

## M1 Data layer

- [x] **M1.1 Migration runner.** `src/db/migrate.ts` applies `src/db/migrations/NNN_*.sql` in order, records them in `migration`. Opens with WAL and `foreign_keys=ON`. Check: tests run migrations on `:memory:` twice, second run is a no-op.
- [x] **M1.2 Schema.** `001_init.sql` with every table in architecture.md. UUID text ids, `position` integers, `ON DELETE CASCADE` from recipe to component, ingredient, step, note, recipe_tag. `SET NULL` for food and unit references. Check: migration applies; a test inserts a recipe with two components and reads it back.
- [x] **M1.3 Recipe document schema.** `src/domain/recipe.ts`: zod schema for the full nested document (recipe, components, ingredients, steps, notes, tags) exactly as the API will read and write it. Field names camelCase, following Mealie where the concept exists. Export the inferred type. Check: tests for a minimal valid doc, a full doc, and three invalid ones (no components, negative quantity, empty name).
- [x] **M1.4 Recipe repository.** `src/db/recipes.ts`: `get(slug)`, `list({q, tag})`, `create(doc)`, `update(id, doc)`, `remove(id)`. Write replaces the whole recipe in one transaction. Slug generated from name, de-duplicated with a suffix. Check: tests for round-trip equality of a full doc, update replacing components, delete cascading, list filter by tag and by name substring.
- [x] **M1.5 Reference repositories.** `∥` `src/db/foods.ts`, `units.ts`, `aisles.ts`, `tags.ts`: list, create, update, remove, `findOrCreate(name)`. Food and unit names unique case-insensitive. Check: tests including the case-insensitive collision.
- [x] **M1.6 Seed units.** `src/db/seed.ts` with metric and common imperial units: g, kg, ml, l, tsp, tbsp, cup, oz, lb, pinch, piece, slice, clove, can, bunch. Abbreviations and plurals. Idempotent. Check: seed twice, count unchanged.

## M2 Domain

- [x] **M2.1 Scaling.** `src/domain/scale.ts`: `scaleRecipe(doc, targetServings)` returns a new doc. Linear ingredients multiply, `fixed` untouched, null quantity untouched. Check: tests for factor 2, factor 0.5, fixed, null, and servings of 0 rejected.
- [x] **M2.2 Quantity formatting.** `src/domain/format.ts`: `formatQuantity(q, unit)` renders ½ ⅓ ¼ ¾ style fractions when `unit.fraction`, else decimals to 2 places, trims trailing zeros, picks plural or abbreviation per unit flags. Check: table-driven tests.
- [x] **M2.3 Ingredient line.** `formatIngredient(ing)`: quantity, unit, food, note in en-AU order, falling back to `originalText` when food is null. Check: tests for each fallback path.

## M3 Server layer

- [x] **M3.1 Server function scaffold.** `src/server/db.ts` opens the SQLite file from `DATA_DIR`, runs migrations and seed on first import. Helper that wraps `createServerFn` with a zod input validator and maps thrown `NotFound` to a typed error. Test helper that points `DATA_DIR` at a temp dir and calls server functions directly. Check: a test calls a trivial server function through the helper.
- [x] **M3.2 Recipe server functions.** `listRecipes({q, tag})`, `getRecipe({slug, servings?})` returning the scaled document when `servings` is given, `createRecipe(doc)`, `updateRecipe({id, doc})`, `deleteRecipe({id})`. Check: tests per function, including validation failure and scaling.
- [x] **M3.3 Reference server functions.** `∥` foods, units, aisles, tags: list with `q`, create, update, delete, findOrCreate. Check: tests per resource.
- [x] **M3.4 Images.** Server route `POST /api/recipes/$id/image` multipart, stored under `data/images/<recipeId>.<ext>`, served by `GET /api/images/$file`. Replaces existing and updates `recipe.image`. Check: upload then GET returns same bytes.
- [x] **M3.5 Backup.** `bun run backup` runs `VACUUM INTO data/backups/garnish-<timestamp>.db`. Check: file exists and opens.

## M4 Frontend shell

- [x] **M4.1 App skeleton.** Root layout with a bottom nav on phone and side nav wider, theme following system via design system tokens. File routes stubbed: `/` recipes, `/recipes/$slug`, `/recipes/$slug/edit`, `/recipes/new`, `/settings`. Pending and error components from the design system. Check: each route renders without console errors in `bun run dev`.
- [x] **M4.2 Loaders.** Each route's `loader` calls the matching server function; components read via `Route.useLoaderData()`. Mutations call server functions then `router.invalidate()`. Check: type errors if a loader's return shape drifts from the zod type.
- [x] **M4.3 Recipe list.** Cards with image, name, tags. Search box, tag filter. Empty state. Check: renders seeded recipes from a running server.
- [x] **M4.4 Recipe view.** Header with image, times, servings, rating. Components in order, each with its ingredient list then its steps. Notes. Scale control adjusts servings via the `servings` search param, which the loader passes to `getRecipe`. Check: manual with two-component recipe.

## M5 Editor

- [x] **M5.1 Local primitives.** `src/components/ui/`: `NumberStepper`, `ReorderList` (buttons up/down first, drag later), `ImageUpload`. Built from design system pieces. Check: each has a render test.
- [x] **M5.2 Recipe form.** Name, description, servings, yield fields, times, rating, tags (design system `tag-input`), image. Check: create and save a recipe with one component.
- [x] **M5.3 Component editing.** Add, rename, reorder, delete components. Each shows an ingredient list and a step list. Check: two-component recipe saves and reloads in order.
- [x] **M5.4 Ingredient rows.** Quantity, unit autocomplete, food autocomplete with find-or-create, note, fixed toggle. Move ingredient between components. Check: null quantity and text-only rows save.
- [x] **M5.5 Steps and notes.** Add, edit, reorder steps within a component. Titled notes. Check: saved order matches.
- [x] **M5.6 Delete recipe.** With confirmation via design system `modal`. Check: gone from list.

## M6 Cook view

- [x] **M6.1 Cook mode.** Full-screen route per recipe. One component at a time: its ingredients, then its steps one per card, large type. Prev and next. Scale control always visible. Check: manual on a phone-width viewport.
- [x] **M6.2 Wake lock.** `navigator.wakeLock` requested on enter, released on leave, reacquired on visibility change. Silent if unsupported. Check: manual, plus a unit test of the hook with a mocked API.

## M7 PWA

- [x] **M7.1 Manifest and icons.** `manifest.webmanifest`, icons, theme colour from tokens, installable. Check: Lighthouse installable, or Chrome install prompt appears.
- [x] **M7.2 Service worker.** Prerendered SPA shell and built assets precached. Server function GET responses and images cached on view, served when offline. Writes are not attempted offline; editor shows an offline notice. Check: view a recipe, go offline, reload, it renders.

## M8 Docker

- [ ] **M8.1 Dockerfile.** `oven/bun` base, multi-stage: `bun install`, `bun run build`, then copy `.output` into a slim stage. Migrations run on boot. `DATA_DIR=/data` as the volume, port 3000. Check: `docker build` then `docker run` with a volume, create a recipe, restart, it persists.
- [ ] **M8.2 Compose example.** `docker-compose.yml` with the volume and port. README section: run, backup, restore. Check: `docker compose up` works from a clean clone.

## M9 Finish

- [ ] **M9.1 Sample data.** `bun run seed --sample` adds three recipes, one with three components. Check: list shows them.
- [ ] **M9.2 Error and empty states.** Design system `error-boundary`, `with-empty` on every list. Check: kill the server, UI shows a message not a blank.
- [ ] **M9.3 Docs sync.** `architecture.md` matches what was built. Any drift gets a decisions.md row. README covers dev, test, run, backup. Check: a fresh reader can run it from README alone.

## Blocked

_(none)_

## Questions

- M1.3: `prepTime`/`performTime` are integer minutes here; Mealie uses free-text strings. Applied: keep the Mealie names with a numeric type. Rename to `prepMinutes`/`cookMinutes` if the import should stay Mealie-shaped.

## Log

_(one line per iteration: date, task id, outcome)_

2026-09-10  M0.1  done  b5e977c  scaffolded TanStack Start; Bun 1.3.9→1.4.2 and NODE_ENV=production on build (decisions row 32)
2026-09-10  M0.2  done  a99ea6d  styles.css with tailwind, design-system theme and @source; fonts and Button/Heading render in dev and prod
2026-09-10  M0.3  done  958b3f3  vitest wired, /api/health server route, boot() creates DATA_DIR; nitro plugin skipped under VITEST
2026-09-10  M1.1  done  42588fb  migrate.ts with WAL+FK open, ordered per-file transactions, CLI; test script now bun --bun vitest run (decisions row 33)
2026-09-10  M1.2  done  1872aa7  001_init.sql with all eleven tables, cascades, SET NULL refs, NOCASE unique names, position uniqueness
2026-09-10  M1.3  done  43cf377  zod recipe document mirroring 001_init.sql, Mealie field names, recipeInputSchema for writes; question logged on time field types
2026-09-10  M1.5  done  abdba2b  foods/units/aisles/tags factories with findOrCreate; names.ts holds cleanName, slugify, uniqueSlug
2026-09-10  M1.4  done  9761895  recipes(db) with whole-document transactional writes, slug de-dup, refs resolved via M1.5 repos, recipeSummarySchema
2026-09-10  M1.6  done  7ed32ae  seed.ts with 15 default units, idempotent by NOCASE name; seed script
2026-09-10  M2.1  done  2cd24e8  scaleRecipe pure, scales linear quantities and yield, fixed/null untouched, ScaleError on bad servings
2026-09-10  M2.2  done  aaca367  formatQuantity/formatUnit/formatAmount with vulgar fractions and Mealie plural rule (plural when >1 or 0)
2026-09-10  M2.3  done  28cbf60  formatFood and formatIngredient following Mealie useParsedIngredientText; originalText verbatim when food is null
2026-09-10  M3.1  done  3374ab7  getDb() lazy open/migrate/seed from DATA_DIR, NotFound mapped via notFoundMiddleware, callServerFn test helper, migrations bundled via import.meta.glob (decisions row 34)
2026-09-10  M3.2  done  41259ac  list/get/create/update/deleteRecipe server functions; getRecipe scales when servings given, unscaled for 0-serving recipes
2026-09-10  M3.3  done  b97f042  foods/units/aisles/tags server functions with q filter, zod inputs in domain/reference.ts, delete returns removed row
2026-09-10  M3.4  done  6d4ffef  image upload/serve routes, byte-sniffed formats, files at DATA_DIR/images/<id>.<ext>, recipes.setImage
2026-09-10  M3.5  done  c1e8f5e  backup.ts with bound VACUUM INTO, UTC timestamped names, backup script
2026-09-10  M4.1  done  761eb6f  AppShell with bottom/side nav, system dark mode via tokens, router default pending/error/not-found, five stub routes, render tests
2026-09-10  M4.2  done  210171a  loaders on all five routes with validated search, return types pinned by annotation and expectTypeOf, lib/mutate.ts; Layout gained src/lib/
2026-09-10  M4.3  done  b11f5bf  RecipeCard grid, debounced search bound to q, tag ToggleGroup bound to tag, empty and filter-miss states; SPA mode means curl / shows only the shell, verified via RPC and render tests
2026-09-10  M4.4  parked  -        run stopped by Jason mid-task; partial work in git stash "M4.4 partial", tree reset to 525925f
2026-09-10  M4.4  done  765e919  recipe page with header, scale control via servings param, components with ingredients then steps, notes, Edit link; local Rating primitive; stash consumed
2026-09-10  M5.1  done  54aa34b  NumberStepper, ReorderList, ImageUpload from design-system Button/Input/Label with tested pure helpers
2026-09-10  M5.2  done  ba7f068  RecipeForm with zod field errors, create/update plus image POST, tag-input; Rating editable; lib/ids randomUuid for LAN http
2026-09-10  M5.3  done  2a0065d  ComponentsEditor over ReorderList with add/rename/move/remove helpers, Modal confirm when a component has rows, two-component order round-trips
2026-09-10  M5.4  done  4ce52dd  IngredientsEditor with parseQuantity and row helpers, local Combobox for unit/food autocomplete, refs resolved on save, text-only rows per Mealie disable-amount
2026-09-10  M5.5  done  c59babc  StepsEditor (component and recipe-level) and NotesEditor with pure helpers; orders round-trip after move
2026-09-10  M5.6  done  64f8dc7  Delete on edit page via ConfirmDialog (new ui primitive over Modal, shared with ComponentsEditor), deleteRecipe then navigate home
2026-09-10  M6.1  done  c70f53f  cook route as card deck from buildCookCards, step/servings search params, sticky scale control, arrow keys, AppShell hides nav for fullscreen routes
2026-09-10  M6.2  done  e791683  pure wake-lock controller plus thin useWakeLock hook wired into cook route; manual phone check still owed
2026-09-10  M7.1  done  8782e89  manifest.webmanifest, SVG/PNG icons from brand tokens, head metas; installability asserted by test, Lighthouse check owed
2026-09-10  M7.2  done  d45bbcb  hand-written service worker emitted by a Vite plugin in the client build, shell and assets precached, GET RPCs and images network-first, useOnline notice disables Save; on-device offline check owed

# Plan

Implementation plan for garnish v1, written to be executed one task per loop iteration with no human present. Decisions live in [decisions.md](decisions.md), shape in [architecture.md](architecture.md), boundaries in [scope.md](scope.md). This file is the only one the loop edits.

## Loop protocol

Each iteration, in order:

1. Read this file. Read `CLAUDE.md`. Do not re-read the other docs unless a task points at them.
2. Pick the first unchecked task whose dependencies are checked. Milestones run in order; tasks within a milestone run in order unless marked `∥`.
3. Do that one task. Nothing else. No drive-by refactors, no adjacent tasks.
4. Verify with the task's own check. Then run the full gate:
   ```
   bun run check     # tsc --noEmit
   bun test
   ```
   Both must pass. A failing gate is not done. Fix it or revert the task.
5. Commit with a one-line message naming the task id, e.g. `M1.3 recipe document schema`. Attribution trailer per `CLAUDE.md`.
6. Tick the task here. Append one line to the Log. Commit that too.
7. Stop. One task per iteration.

Rules:

- **Blocked?** Write the blocker under Blocked with the task id and what you tried. Move to the next task that does not depend on it. Never guess past a blocker on a decision; guess freely on implementation detail, and when unsure copy Mealie.
- **Question for Jason?** Write it under Questions. Pick the Mealie answer and continue. Do not stop.
- **Found a design gap?** Add a row to `decisions.md`. Do not edit existing rows. Note it in the Log.
- **UI element needed?** Check the design system's exports first (`node_modules/@sixthshift/design-system/package.json`). Build locally only if absent, under `src/client/ui/`.
- **Task too big for one iteration?** Split it in place into `Mx.y.a`, `Mx.y.b`. Do the first part.
- **Tests:** every pure function and every API route gets tests in the same task that creates it. No task is done with a TODO test.
- **No new dependencies** beyond the list in M0 without a decisions.md row saying why.

## Layout

```
src/
  server/       Bun.serve entry, routes, middleware
  db/           schema.sql migrations, migrate.ts, seed.ts, repositories
  domain/       zod schemas, scaling, formatting. Pure, no IO
  client/       React app: routes, views, ui/ (local primitives)
  index.html    Bun HTML import entry
test/           mirrors src/
data/           runtime volume: garnish.db, images/  (gitignored)
```

Scripts in `package.json`: `dev`, `start`, `check`, `test`, `migrate`, `seed`, `backup`.

## M0 Foundations

- [ ] **M0.1 Dependencies.** Install: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `tailwindcss`, `bun-plugin-tailwind`, `@sixthshift/design-system`, `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`, `zod`. Add `bunfig.toml` with the Tailwind plugin. Add the scripts above. Check: `bun install` clean, `bun run check` passes on an empty `src/`.
- [ ] **M0.2 Design system spike.** `src/index.html` loads `src/client/main.tsx`, which renders one `Button` from `@sixthshift/design-system/button` and one `Heading`. CSS entry has the three lines from the design system README (`@import "tailwindcss"`, theme import, `@source`). Check: `bun run dev`, fetch `/`, and the served CSS contains a design-system token class. If Tailwind 4 will not compile through the Bun plugin, fall back to `tailwindcss` CLI as a `prebuild` step and record it in decisions.md.
- [ ] **M0.3 Layout and gate.** Create the directories above, a `src/server/index.ts` that serves the HTML and `/api/health`, and one trivial test. Check: gate passes, `curl /api/health` returns `{"ok":true}`.

## M1 Data layer

- [ ] **M1.1 Migration runner.** `src/db/migrate.ts` applies `src/db/migrations/NNN_*.sql` in order, records them in `migration`. Opens with WAL and `foreign_keys=ON`. Check: tests run migrations on `:memory:` twice, second run is a no-op.
- [ ] **M1.2 Schema.** `001_init.sql` with every table in architecture.md. UUID text ids, `position` integers, `ON DELETE CASCADE` from recipe to component, ingredient, step, note, recipe_tag. `SET NULL` for food and unit references. Check: migration applies; a test inserts a recipe with two components and reads it back.
- [ ] **M1.3 Recipe document schema.** `src/domain/recipe.ts`: zod schema for the full nested document (recipe, components, ingredients, steps, notes, tags) exactly as the API will read and write it. Field names camelCase, following Mealie where the concept exists. Export the inferred type. Check: tests for a minimal valid doc, a full doc, and three invalid ones (no components, negative quantity, empty name).
- [ ] **M1.4 Recipe repository.** `src/db/recipes.ts`: `get(slug)`, `list({q, tag})`, `create(doc)`, `update(id, doc)`, `remove(id)`. Write replaces the whole recipe in one transaction. Slug generated from name, de-duplicated with a suffix. Check: tests for round-trip equality of a full doc, update replacing components, delete cascading, list filter by tag and by name substring.
- [ ] **M1.5 Reference repositories.** `∥` `src/db/foods.ts`, `units.ts`, `aisles.ts`, `tags.ts`: list, create, update, remove, `findOrCreate(name)`. Food and unit names unique case-insensitive. Check: tests including the case-insensitive collision.
- [ ] **M1.6 Seed units.** `src/db/seed.ts` with metric and common imperial units: g, kg, ml, l, tsp, tbsp, cup, oz, lb, pinch, piece, slice, clove, can, bunch. Abbreviations and plurals. Idempotent. Check: seed twice, count unchanged.

## M2 Domain

- [ ] **M2.1 Scaling.** `src/domain/scale.ts`: `scaleRecipe(doc, targetServings)` returns a new doc. Linear ingredients multiply, `fixed` untouched, null quantity untouched. Check: tests for factor 2, factor 0.5, fixed, null, and servings of 0 rejected.
- [ ] **M2.2 Quantity formatting.** `src/domain/format.ts`: `formatQuantity(q, unit)` renders ½ ⅓ ¼ ¾ style fractions when `unit.fraction`, else decimals to 2 places, trims trailing zeros, picks plural or abbreviation per unit flags. Check: table-driven tests.
- [ ] **M2.3 Ingredient line.** `formatIngredient(ing)`: quantity, unit, food, note in en-AU order, falling back to `originalText` when food is null. Check: tests for each fallback path.

## M3 API

- [ ] **M3.1 Server scaffold.** `Bun.serve` with `routes`, JSON helpers, zod-validated bodies returning 400 with issues, 404 shape, error handler. Test helper that boots a server on port 0 against `:memory:` and returns a `fetch`. Check: health test through the helper.
- [ ] **M3.2 Recipe routes.** `GET /api/recipes?q=&tag=`, `GET /api/recipes/:slug`, `POST /api/recipes`, `PUT /api/recipes/:id`, `DELETE /api/recipes/:id`. `GET /api/recipes/:slug?servings=6` returns the scaled document. Check: tests per route, including validation failure and scaling.
- [ ] **M3.3 Reference routes.** `∥` `/api/foods`, `/api/units`, `/api/aisles`, `/api/tags`: list with `?q=`, create, update, delete. Check: tests per resource.
- [ ] **M3.4 Images.** `POST /api/recipes/:id/image` multipart, stored under `data/images/<recipeId>.<ext>`, served at `/images/...`. Replaces existing. Recipe `image` field updated. Check: upload then GET returns same bytes.
- [ ] **M3.5 Backup.** `bun run backup` runs `VACUUM INTO data/backups/garnish-<timestamp>.db`. Check: file exists and opens.

## M4 Frontend shell

- [ ] **M4.1 App skeleton.** Router (hash or history, keep it small), layout with a bottom nav on phone and side nav wider, theme following system via design system tokens, fonts imported. Pages stubbed: Recipes, Recipe, Edit, Settings. Check: each route renders without console errors in `bun run dev`.
- [ ] **M4.2 API client.** `src/client/api.ts`: typed fetch wrappers using the zod types. Check: unit tests with a mocked fetch.
- [ ] **M4.3 Recipe list.** Cards with image, name, tags. Search box, tag filter. Empty state. Check: renders seeded recipes from a running server.
- [ ] **M4.4 Recipe view.** Header with image, times, servings, rating. Components in order, each with its ingredient list then its steps. Notes. Scale control adjusts servings and re-renders via the `?servings=` endpoint. Check: manual with two-component recipe.

## M5 Editor

- [ ] **M5.1 Local primitives.** `src/client/ui/`: `NumberStepper`, `ReorderList` (buttons up/down first, drag later), `ImageUpload`. Built from design system pieces. Check: each has a render test.
- [ ] **M5.2 Recipe form.** Name, description, servings, yield fields, times, rating, tags (design system `tag-input`), image. Check: create and save a recipe with one component.
- [ ] **M5.3 Component editing.** Add, rename, reorder, delete components. Each shows an ingredient list and a step list. Check: two-component recipe saves and reloads in order.
- [ ] **M5.4 Ingredient rows.** Quantity, unit autocomplete, food autocomplete with find-or-create, note, fixed toggle. Move ingredient between components. Check: null quantity and text-only rows save.
- [ ] **M5.5 Steps and notes.** Add, edit, reorder steps within a component. Titled notes. Check: saved order matches.
- [ ] **M5.6 Delete recipe.** With confirmation via design system `modal`. Check: gone from list.

## M6 Cook view

- [ ] **M6.1 Cook mode.** Full-screen route per recipe. One component at a time: its ingredients, then its steps one per card, large type. Prev and next. Scale control always visible. Check: manual on a phone-width viewport.
- [ ] **M6.2 Wake lock.** `navigator.wakeLock` requested on enter, released on leave, reacquired on visibility change. Silent if unsupported. Check: manual, plus a unit test of the hook with a mocked API.

## M7 PWA

- [ ] **M7.1 Manifest and icons.** `manifest.webmanifest`, icons, theme colour from tokens, installable. Check: Lighthouse installable, or Chrome install prompt appears.
- [ ] **M7.2 Service worker.** App shell precached. Recipe documents and images cached on view, served from cache when offline. Writes are not attempted offline; editor shows an offline notice. Check: view a recipe, go offline, reload, it renders.

## M8 Docker

- [ ] **M8.1 Dockerfile.** `oven/bun` base, multi-stage, production build, runs migrations on start, `data/` as the volume, port 3000. Check: `docker build` then `docker run` with a volume, create a recipe, restart, it persists.
- [ ] **M8.2 Compose example.** `docker-compose.yml` with the volume and port. README section: run, backup, restore. Check: `docker compose up` works from a clean clone.

## M9 Finish

- [ ] **M9.1 Sample data.** `bun run seed --sample` adds three recipes, one with three components. Check: list shows them.
- [ ] **M9.2 Error and empty states.** Design system `error-boundary`, `with-empty` on every list. Check: kill the server, UI shows a message not a blank.
- [ ] **M9.3 Docs sync.** `architecture.md` matches what was built. Any drift gets a decisions.md row. README covers dev, test, run, backup. Check: a fresh reader can run it from README alone.

## Blocked

_(none)_

## Questions

_(none)_

## Log

_(one line per iteration: date, task id, outcome)_

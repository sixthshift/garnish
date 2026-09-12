# Plan

Implementation plan for garnish, stages 7 to 11 (what surrounds the recipe: the shopping list, sub-recipes and conversions, the meal plan, export and import, and a bundle of small parity items), written to be executed one task per loop iteration with no human present. Decisions live in [decisions.md](decisions.md), shape in [architecture.md](architecture.md), boundaries in [scope.md](scope.md). Run it with `/ailoop` (see `.claude/skills/ailoop/SKILL.md`): one fresh subagent per task, the orchestrator verifies and records. This file is edited only by the orchestrator. Completed stages live in `docs/plans/`; stage 1 is [v1-foundations.md](plans/v1-foundations.md), stage 2 [v2-ui.md](plans/v2-ui.md), stage 3 [v3-parsing.md](plans/v3-parsing.md), stage 4 [v4-editor.md](plans/v4-editor.md), stage 5 [v5-recipe-page.md](plans/v5-recipe-page.md), stage 6 [v6-step-card.md](plans/v6-step-card.md).

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


## Stages 7 to 11: around the recipe

Six stages built the recipe: the model, the parser, the editor, the import, the page, the step card. It is at parity with Mealie and Tandoor or ahead. What both incumbents have that garnish does not is everything around the recipe, and the schema has anticipated most of it since stage 1: `aisle`, `food.skip_shopping`, `unit.standard_*`, `food.recipe_id`, the merge rule in decision 13, the disabled "Add to shopping list" button from M30.4.

The order, and the garnish-shaped version of each:

- **Stage 7, the shopping list.** One list, no owner. Merge by food and unit, expand a line to its sources, group by aisle. Add from the recipe at the current scale. The garnish-specific problem: the supermarket is not on the LAN, so the list must open and tick offline. That is the app's first queued write.
- **Stage 8, sub-recipes and conversions.** A food that points at a recipe renders as a link with a scale hint; conversions per food so a cup and 300 g of flour merge; then the list scales through a sub-recipe. Conversions before expansion, or the list gets two flour lines.
- **Stage 9, the meal plan.** A week strip, a recipe or a line of text on a day, one tap adds the week to the list. No meal types, no per-person plans.
- **Stage 10, out and in.** JSON and Cooklang export, import from Mealie and Tandoor backups (the adoption path neither incumbent offers), then `claude -p` import as the rung under JSON-LD, landing on the existing review step.
- **Stage 11, small parity items.** Step images, servings on a cook log entry, an ingredient preview on the card, a fetch that gets past a bot wall. Independent of each other and of the stages above; `∥`.

Migrations run 005 to 009 in stage order. Each new table gets a Drizzle mirror and the drift test. Each stage's first task carries the decisions row for its model.

Not in these stages, and not to be re-raised without a decisions row: nutrition and costing, cookbooks or any second organiser beside tags (decision 42), comments, share links, categories and tools, per-person or per-meal-type planning, inventory (intent.md), and a DOM test environment (the stage 5 question still stands for Jason).

## M31 The shopping list

- [x] **! M31.1 The list's tables.** `src/db/migrations/005_shopping.sql`: `shopping_item (id, position, food_id? SET NULL, unit_id? SET NULL, quantity REAL?, text TEXT NOT NULL DEFAULT '', ticked INTEGER NOT NULL DEFAULT 0, created_at, updated_at)` and `shopping_item_source (id, item_id CASCADE, recipe_id? SET NULL, recipe_name TEXT, part_name TEXT, servings REAL?, quantity REAL?)`, so a line remembers where it came from even after the recipe is deleted. Drizzle mirror in `src/db/models/shopping/schema.ts`, repository in `repo.ts` (list, add many, update, tick, remove, clear ticked, reorder), document in `src/domain/shopping.ts` (zod, camelCase, `sources` nested), server functions in `src/server/shopping.ts`. `architecture.md` gains a Shopping list section replacing the design-only one; decisions.md row (one household list, items keep their provenance). Check: migrate fresh and existing; repository round-trip tests including a source surviving its recipe's deletion; the drift test.
- [x] **M31.2 Merging into the list.** `src/domain/shopping.ts` gains `mergeIntoList(items, additions)`: an addition with the same food and unit as an unticked item adds its quantity and appends its source; a ticked item is left alone and a new line is made; a free-text addition never merges; a `skipShopping` food is dropped; a text-only ingredient (no food) becomes a free-text line with its `originalText`. Pure, reuses `mergeIngredients`'s rules where they match. Check: a table test per rule, and one over a whole recipe at scale 2.
- [ ] **! M31.3 Add from the recipe.** The disabled button from M30.4 goes live: a `sheet` listing the recipe's ingredients at the page's current scale, every row ticked to include, tap to exclude, with the part name as a group heading on a multi-part recipe; **Add** runs M31.2 against the current list through `addShoppingItems` and toasts "N items added" with a link to the list. Cook mode's finish card gets the same button. Check: render tests for the sheet; a test that Add sends only the included rows at the scaled quantities with the recipe as source.
- [ ] **! M31.4 The list page.** `/shopping`: a nav item between Recipes and Settings. Items grouped by aisle in `aisle.position` order, unassigned last, each group a heading; a row is a tick box, amount and food (or the text), and a chevron that expands the sources ("Lemon Tart, Pastry, serves 4"); ticked rows sink to a "Ticked" group at the foot with **Clear ticked**. A free-text input at the top adds a line on Enter. Phone first: rows are tap targets, nothing hover-only. Check: render tests for grouping, the sources expansion, the ticked group and the empty state.
- [ ] **! M31.5 Ticks that work in the supermarket.** The list must open and tick with no server. `src/lib/outbox.ts`: a queue of pending writes (tick, untick, remove) in `localStorage`, applied to the rendered list optimistically and flushed in order when `useOnline` turns true or the page regains focus; a flush failure keeps the entry and shows "N changes waiting" in the page header. The service worker's data cache already keeps the last list read. `RecipeForm`'s "writes are never attempted offline" stays true for everything else; the list is the one exception and the row says why. decisions.md row. Check: tests over the pure queue (enqueue, coalesce a tick and untick of the same item, flush order, a failed flush retained); a render test that an offline tick shows ticked and queues.
- [ ] **M31.6 Aisles from the list.** A row whose food has no aisle shows a quiet "Set aisle" in its expansion, a `Select` over the aisles writing `updateFood`; the row moves group on the next read. Foods and aisles stay managed in Settings as today. Check: render test for the control's presence only on unassigned foods; a test that choosing writes the food.

## M32 Sub-recipes and conversions

- [ ] **! M32.1 Conversions per food.** `src/db/migrations/006_conversions.sql`: `food_conversion (id, food_id CASCADE, unit_id CASCADE, quantity REAL NOT NULL, to_unit_id CASCADE, to_quantity REAL NOT NULL, UNIQUE (food_id, unit_id, to_unit_id))`, read as "1 cup of flour is 125 g". Drizzle mirror, repository under `src/db/models/food/`, the food document gains `conversions: []`, server functions on `foods`. The food edit sheet in Settings gains a conversions editor: rows of quantity, unit, equals, quantity, unit. decisions.md row (conversions live on the food, not the unit; `unit.standard_*` stays for unit-to-unit like ml to l). Check: migrate; repository round-trip; render test for the editor.
- [ ] **M32.2 Convert.** `src/domain/convert.ts`: `convert(quantity, unit, food, toUnit)` through the food's conversions, then `unit.standard_*` for unit-to-unit, chaining one hop each way; null when no path. `mergeIntoList` (M31.2) uses it: two lines for one food in convertible units merge into the metric one. Pure. Check: a table test over direct, reverse, one-hop chained, and no path; a merge test that a cup and 300 g of flour become one line.
- [ ] **! M32.3 A food made by a recipe.** `food.recipe_id` becomes editable: the food edit sheet in Settings gains "Made by a recipe", a `Combobox` over recipes by name; the recipe page's action menu gains "Make this a food", which creates or links a food of the recipe's name with `recipeId` set. An ingredient row whose food has a recipe renders the food as a link to it, with a hint from `subRecipeScale(ingredient, child)` in `src/domain/subRecipe.ts`: the servings of the child that yield the ingredient's amount, through the child's `recipeYieldQuantity` and `yieldUnit` and M32.2's `convert`; null when they cannot be related, and then the link has no hint. decisions.md row (a link with a scale hint; the parent never inlines the child). Check: tests for `subRecipeScale` over matching units, convertible units and unrelated ones; render tests for the row link and hint.
- [ ] **M32.4 Cook through it.** In cook mode, a step card whose linked ingredient is a sub-recipe shows "Open <child> at N servings" under the row, a link into the child's cook mode with `?servings=`; the child's finish card offers "Back to <parent>" when it was entered that way (`?from=` slug). Check: render tests for the link and the way back.
- [ ] **M32.5 The list scales through it.** Adding a parent recipe to the list (M31.3) offers, per sub-recipe row, "Add hollandaise's ingredients instead", which adds the child's ingredients at the servings M32.3 derived; without a derivable scale the food itself is added as a line. Check: a test that the child's rows arrive scaled with the child as source; a test that an underivable scale adds the food line.

## M33 The meal plan

- [ ] **! M33.1 The plan's table.** `src/db/migrations/007_plan.sql`: `meal_plan_entry (id, date TEXT NOT NULL (YYYY-MM-DD), position, recipe_id? SET NULL, text TEXT NOT NULL DEFAULT '', servings REAL?)`, so a day holds recipes or plain lines ("leftovers"). Drizzle mirror, repository under `src/db/models/plan/` (a week's entries, add, update, move, remove), document and server functions. decisions.md row (one plan, days not meals). Check: migrate; round-trip; the drift test.
- [ ] **! M33.2 The week.** `/plan`: a nav item. Seven columns from `md`, a vertical list of days below it, today marked, arrows for the previous and next week (`?week=` as the Monday's date). A day has its entries as small cards (image, name, servings) and an add row: type to search recipes (the `GlobalSearch` list reused) or press Enter on unmatched text for a plain line. Entries move between days by drag (`ReorderList`'s group drag) or a row menu. Check: render tests for the week, an entry of each kind, and the empty day.
- [ ] **M33.3 The week to the list.** "Add this week to the shopping list" in the plan's header runs M31.2 over every recipe entry at its servings (the recipe's own when unset), with the plan day as part of the source. Check: a test over a week with two recipes and a text line.
- [ ] **M33.4 Plan from the recipe.** The recipe page's action menu gains "Plan", a popover with the next seven days and a servings stepper defaulting to the page's scale. Check: render test; a test that choosing a day writes an entry.

## M34 Out and in

- [ ] **M34.1 JSON export.** `GET /api/recipes/:slug.json` returns the recipe document; `GET /api/export.json` returns every recipe's document plus the foods, units, aisles and tags, images referenced by their `/api/images/` URLs. Settings gains an Export tab with a download link and a note that images are not in the file. decisions.md row (reverses decision 4's "no file export in v1" now that v1 is done; the database stays the master). Check: route tests for both, including a recipe with links and a sub-recipe.
- [ ] **M34.2 Cooklang export.** `src/domain/cooklang.ts`: `toCooklang(recipe)`: metadata block (servings, source, tags), a `== Part ==` section per named part, steps with `@food{qty%unit}` where the step links the row and the plain text otherwise, `=` for fixed quantities, timers as `~{20%minutes}` from `durationsIn`. Pure. `GET /api/recipes/:slug.cook` serves it; the recipe menu gains "Copy as Cooklang". Check: a golden-file test over the three sample recipes; a property test that every linked food appears as an `@` reference.
- [ ] **! M34.3 Import a Mealie backup.** The source chooser gains a third option, **a Mealie or Tandoor export**, taking a file. `src/domain/importMealie.ts`: reads Mealie's backup zip or a single recipe JSON; `recipeIngredient` rows with a `title` open a new part, as do `recipeInstructions` with one; `food`/`unit`/`quantity`/`note` map straight across, `originalText` kept; `tags` and `categories` both become tags; `notes`, `rating`, `recipeYield`, times, `orgURL` to `sourceUrl`; the image is fetched from the zip. Steps get links through `suggestLinks`. Reviewed through the M17.5 rows before anything is written; duplicates by name are warned as M23.7 warns by URL. Check: a fixture from Mealie's documented format with sections; a test that a `title` becomes a part.
- [ ] **! M34.4 Import a Tandoor export.** `src/domain/importTandoor.ts` for Tandoor's JSON export: each `step` with ingredients becomes a part named from the step's `name` (or the unnamed body when blank), its `instruction` the part's one step, its ingredients the part's rows already linked to that step; `keywords` become tags; `servings`, `working_time`, `waiting_time`, `source_url`, `description`; nested-recipe steps become a food with `recipeId` when the child is in the same export, else a text line. Same chooser, same review. Check: a fixture with two steps and a nested recipe.
- [ ] **! M34.5 `claude -p` import.** The rung under JSON-LD and OpenGraph (decision 58) for pasted prose and pages with no structured data: `src/server/aiImport.ts` runs `claude -p` through `Bun.$` with the page text or the paste and a strict JSON schema for `ScrapedRecipe` (`--output-format json`), 60 s timeout, and hands the result to the same review the URL import uses. Shown only when the `claude` binary is on the path (`Bun.which`), with a Settings note on `claude setup-token` for the container (decision 12). The paste box from decision 52 returns as the entry point, gated the same way. decisions.md row (supersedes decision 10's "no AI in v1"; row 11's `claude -p` on subscription stands). Check: a test with the runner injected returning a fixture; a test that a missing binary hides the option; a test that a malformed answer is reported, not saved.

## M35 Small parity items

- [ ] **∥ M35.1 Step images.** `src/db/migrations/008_step_images.sql` adds `step.image TEXT?`; `POST /api/steps/:id/image` and `GET /api/images/steps/:file` as the recipe and timeline pairs are; the step row menu in the editor gains "Add image"; `StepCard` shows it above the text at both sizes. Check: route tests; a render test at both sizes.
- [ ] **∥ M35.2 Servings on a cook.** `009_cook_servings.sql` adds `timeline_event.servings REAL?`; the Made this sheet gains a servings stepper defaulting to the page's scale; the History row shows "serves 6" when set. Check: round-trip; render tests.
- [ ] **∥ M35.3 Ingredients on the card.** From `md`, hovering a recipe card shows its first six ingredient lines in a `Tooltip`; the summary gains `ingredientPreview: string[]` from the repository. Check: repository test; render test.
- [ ] **∥ M35.4 Past the bot wall.** `importFromUrl` sends a full browser header set (`Accept`, `Accept-Language`, `Sec-Fetch-*`, a current Chrome `User-Agent`) and, on a 403, retries once with a second profile; still blocked, the error names the site and suggests the paste box. Recorded 403 and 200 fixtures. Check: tests for the retry and the message. Note in the task's Log whether Serious Eats now passes; TLS fingerprinting is out of reach for `fetch` and stays deferred.

## Blocked

_(none)_

## Questions

- M31.5 is the app's first queued write. The design in the task (local queue, optimistic apply, flush on reconnect, "N changes waiting") is the default; Jason may want a different one before it runs.

## Log

_(one line per iteration: date, task id, outcome, model)_

2026-09-13  —      note   —        —      stashed a one-line uncommitted RecipeCard.tsx change left by a previous run (`git stash -u`)
2026-09-13  M31.1  done   ea86435  opus   005_shopping.sql, Drizzle mirror, repo, domain doc, server functions; architecture Shopping list section built; decisions row 67
2026-09-13  M31.2  done   f797c6b  sonnet mergeIntoList in src/domain/shopping.ts returns a {merges, additions} plan; merges by food+unit onto unticked lines, ticked/free-text/food-less start new lines, skipShopping dropped

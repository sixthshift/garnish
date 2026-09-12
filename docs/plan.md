# Plan

Implementation plan for garnish, stage 6 (step ownership, the step card, and a quieter page), written to be executed one task per loop iteration with no human present. Decisions live in [decisions.md](decisions.md), shape in [architecture.md](architecture.md), boundaries in [scope.md](scope.md). Run it with `/ailoop` (see `.claude/skills/ailoop/SKILL.md`): one fresh subagent per task, the orchestrator verifies and records. This file is edited only by the orchestrator. Completed stages live in `docs/plans/`; stage 1 is [v1-foundations.md](plans/v1-foundations.md), stage 2 [v2-ui.md](plans/v2-ui.md), stage 3 [v3-parsing.md](plans/v3-parsing.md), stage 4 [v4-editor.md](plans/v4-editor.md), stage 5 [v5-recipe-page.md](plans/v5-recipe-page.md).

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


## Stage 6: The step card

Stage 5 made the recipe page more capable and busier. Jason's review: chips spliced into step prose, three layers of fixed chrome on a phone, a Made this section that spends vertical space on history nobody reads while cooking, and a two-column layout that is good for gathering ingredients but does nothing to line an ingredient up with the step that uses it. The cook button is the part that works.

The model, settled with Jason on 2026-09-12: **a recipe is made of parts, and that is it. Each part contains its ingredients and its steps. Steps link to ingredients.** Ownership is the tree and has one answer: where a row lives, how much to buy, what the prep list shows. Linking is not the tree: a step may link any ingredient in its own part, and an ingredient may be linked from several steps of that part. Butter lives in the pastry and is used in pastry step 1 and pastry step 4. A link never crosses a part: a step that needs another part's ingredient is a sign the row belongs in this part, or in the recipe's body. Nothing about the tree changes; decisions 22 and 49 stand.

Three things this stage does, in order:

- **Step links.** A `step_ingredient` link table, stored, not inferred. The name matcher from M26.1 becomes the suggestion engine that proposes links on import and on request, never silently on save.
- **The step card.** One card per step: number, the ingredients it links, the text, its timers in the footer. The same component is the cook deck's step card in large type, so the page is the deck laid out and cook mode is the deck one at a time. The left column stays as the prep list. The chips, the floating Ingredients button, the timer chips inside prose and the long press all go.
- **A quieter page.** Made this becomes a line in the header strip, a button after the last step, and a closed disclosure at the foot. The scale-by-ingredient form, the sheet's second rating and the empty-state "Not made yet" go.

Not in this stage, and not to be re-raised without a decisions row: splitting one ingredient's amount across steps (a link carries the whole row; a genuinely split amount is two rows), step images, nutrition, a shopping list (the "Add to shopping list" button is designed in M30.4 so the list is built against a real button, but the list itself stays Later), and a DOM test environment (three stage 5 questions stand as one decision for Jason).

## M28 Step links

- [x] **! M28.1 `step_ingredient`.** `src/db/migrations/004_step_links.sql` creates `step_ingredient (step_id REFERENCES step ON DELETE CASCADE, ingredient_id REFERENCES ingredient ON DELETE CASCADE, PRIMARY KEY (step_id, ingredient_id))` with an index on `ingredient_id`. The Drizzle table in `src/db/models/recipe/schema.ts` mirrors it and `test/db/drift.test.ts` agrees. The document (`src/domain/recipe.ts`) gains `ingredientIds: z.array(id).default([])` on the step, in both read and write shapes, in link order. The repository writes a part's ingredients, then its steps, then the links; a link naming an ingredient outside the step's own part is dropped rather than failing the save. `architecture.md`'s data model and document sections are updated; decisions.md row (steps link ingredients, many to many, same part only). Check: migrate a fresh database and an existing one; a round-trip test that a step linking two of its part's rows reads back with both and a row linked from two steps reads back on both; a test that a link across parts reads back dropped; the drift test.
- [x] **M28.2 Suggesting links.** `src/domain/stepIngredients.ts` gains `suggestLinks(part)`: for every step with no links, the part's ingredients that `ingredientsInStep`'s rules find in its text, in list order; steps that already have links are left alone. Pure. The URL import's `draftFromScraped` (M23.6) applies it to each part before handing over the draft, so an imported recipe arrives with its links filled for review. Check: a table test over a step naming two rows (both linked), a row named in two steps (linked from both), a step already linked (untouched), a step naming nothing (stays empty), and a food that exists only in another part (not linked); an import test that the draft carries the suggestions.
- [ ] **M28.3 The editor knows about links.** Each step row in `StepsEditor` gains an "Ingredients" picker: a `Combobox` over the part's ingredients by their formatted lines; chosen rows show as removable chips under the step's textarea. The part's step header gains "Suggest links", which runs M28.2 over the part and reports how many it filled. Deleting an ingredient row removes it from every step's links, and moving a row to another part removes it from the links of the part it left, in the draft, before save. Check: render tests for the picker and chips; tests that deleting a row and moving a row out clear its links; a test that Suggest links fills only unlinked steps.

## M29 The step card

- [x] **! M29.1 `StepCard`.** `src/components/StepCard.tsx`: a quiet card (border, no shadow) with the step number, the ingredients the step links as `IngredientRow`s (ticks shared, a row linked from two steps shows on both cards), the step text through `Markdown` with no decorator, and a footer holding one `TimerChip` per duration `durationsIn` finds (deduplicated by seconds). From `md` the card is two columns inside: ingredients narrow on the left, text right; below `md` the list sits above the text. A `size` prop, `page` or `cook`, sets the type scale. Tapping the text still ticks the step. `StepList` renders `StepCard`s; `StepRow`, `StepIngredientChips` and `decorateDurations` are deleted, and `Markdown`'s `decorate` prop goes with them if nothing else uses it. decisions.md row (the view page and cook mode share one card). Check: render tests at both sizes with two linked ingredients, none, and a duration; the tick and timer tests move to the card.
- [ ] **M29.2 Cook mode deals the same cards.** `CookCardView`'s step branch renders `StepCard size="cook"`. The per-part ingredients card at the front of each part stays, showing only the part's ingredients that none of its steps link, so a linked row is read on its step and an unlinked one at the start of its part; a part where every ingredient is linked gets no ingredients card. `nextPreview` and the finish card stay. Check: cook route render tests for a linked ingredient appearing on its step card and not on the ingredients card; a part with everything linked skipping the ingredients card.
- [x] **M29.3 The prep list stays; the rest goes.** The left column keeps every ingredient of every part (it is the gather-everything list). The floating Ingredients button, `IngredientsSheet` and `useScrolledOff` are deleted with their tests. The Made this button and `TimelineList` come off this task's route edits (M30 moves them). Check: the full suite; a grep finds no `IngredientsSheet` or `useScrolledOff`.
- [ ] **M29.4 Fewer controls.** The scale-by-ingredient form leaves `ScaleControl`'s popover (`scalableIngredients` goes if unused). The Made this sheet loses its stars: rating lives in the header only. Quick edit keeps the hover pencil on an ingredient row from `md` and gains a quiet `⋯` in the step card's corner holding "Edit step"; the long press and `useLongPress` are deleted. Check: render tests for the popover (one form), the sheet (no stars), the card menu; a grep finds no `useLongPress`.

## M30 Made this, subtly

- [x] **M30.1 One line in the strip.** The header strip's last-made entry reads "Last made 3 Sep · 4 times" (count from the timeline the loader already reads; "Never made" as today with no events). `RecipeHeader` takes the count as a prop. Check: render tests for zero, one and four events.
- [ ] **M30.2 The button after the last step.** `MadeThisButton` renders once, in a row under the last step card on the page, and on the cook finish card as today. It leaves `TimelineList`. Check: route render test for its position; the finish card test still passes.
- [x] **M30.3 History as a disclosure.** `TimelineList` becomes a closed `Disclosure` titled "History" with the count in its hint, at the foot of the page above the meta footer, one compact row per cook: date, comment on the same line (truncated, expanding on tap), a small square thumbnail when there is a photo, delete in a row menu. Renders nothing with no events. "Not made yet" goes. decisions.md row. Check: render tests for closed-by-default, the compact row with and without a photo, and nothing rendered when empty.
- [ ] **M30.4 Save a comment as a note.** A cook's row menu gains "Save as note", which appends `{ title: "Made <date>", text: comment }` to the recipe's notes through `updateRecipe` with the stored document, and says so. The page also gains a disabled "Add to shopping list" button beside Cook with a tooltip "Coming later", so the page is designed against the button the list will need; scope.md's Later entry for the shopping list notes it. Check: a test that the sent document is the stored one plus one note; the disabled button renders with its tooltip.

## Blocked

_(none)_

## Questions

_(none)_

## Log

_(one line per iteration: date, task id, outcome, model)_

2026-09-12  M30.1  done  7d2b9f6  sonnet  RecipeHeader takes madeCount and the strip reads "Last made 3 Sep · 4 times" (1 time, Never made); the view route passes timeline.length. Cherry-picked from task/M30.1. Pre-run dirty tree (RecipeCard aspect class) stashed again as stash@{0}
2026-09-12  M28.1  done  dac78cb  opus  004_step_links.sql creates step_ingredient (step_id, ingredient_id, position); step.ingredientIds in both document shapes; the repository writes ingredients, steps, then links and drops a link outside the step's part; architecture.md updated. decisions.md row 64. Cherry-picked from task/M28.1
2026-09-12  M30.3  done  0bb2af8  sonnet  TimelineList is a closed Disclosure "History" with the count as hint, one compact row per cook (date, truncated tap-to-expand comment, square thumbnail, Delete in a row menu), nothing when empty; MadeThisButton moves out to the route above it for M30.2. decisions.md row 65 (renumbered from 64 on cherry-pick). Cherry-picked from task/M30.3 with one conflict in decisions.md
2026-09-12  M28.2  done  603b9d1  sonnet  suggestLinks(part) fills only unlinked steps with the part's matching rows, in list order; draftFromScraped applies it per part so an import arrives with links to review. Cherry-picked from task/M28.2
2026-09-12  M29.1  done  4b4a152  opus  StepCard: number, the step's linked rows as IngredientRows, plain Markdown, timers in a footer, two columns inside from md, size page or cook; StepRow, StepIngredientChips, decorateDurations and Markdown's decorate deleted; the cook route renders plain text until M29.2. decisions.md row 66. Cherry-picked from task/M29.1
2026-09-12  M29.3  done  b3bfb2d  sonnet  the floating Ingredients button, IngredientsSheet and useScrolledOff deleted with their tests; TimerStrip drops to bottom-20 on a phone. Cherry-picked from task/M29.3

# Plan

Implementation plan for garnish, stage 5 (the recipe page, cook mode and the editor's way in), written to be executed one task per loop iteration with no human present. Decisions live in [decisions.md](decisions.md), shape in [architecture.md](architecture.md), boundaries in [scope.md](scope.md). Run it with `/ailoop` (see `.claude/skills/ailoop/SKILL.md`): one fresh subagent per task, the orchestrator verifies and records. This file is edited only by the orchestrator. Completed stages live in `docs/plans/`; stage 1 is [v1-foundations.md](plans/v1-foundations.md), stage 2 [v2-ui.md](plans/v2-ui.md), stage 3 [v3-parsing.md](plans/v3-parsing.md), stage 4 [v4-editor.md](plans/v4-editor.md).

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


## Stage 5: Cooking from it

Four stages built a recipe page that is a faithful Mealie clone poured into one 768px column, and the column is the problem. Deciding whether to cook something, shopping for it and cooking from it all get the same scroll in the same order. Both incumbents split ingredients from method at tablet width; here they never split, and cook mode compensates by becoming a different app, a slideshow, which drops the one thing you need mid-step: the ingredients beside it. Meanwhile the plumbing is ahead of the page: ticks shared between view and cook, the parts model, the bulk-add review and the discard guard are all better than either incumbent, and the page does not use them well. Some of what the docs claim is not there at all: decision 51 says rating is set from the view page, and the view page's stars have no handler.

Four things this stage fixes, in order:

- **The column.** Two columns from `md`, the header reordered so the first ingredient is near the top on a phone, servings in the ingredients heading where Mealie has it, notes read before you start.
- **The controls.** Scaling that does not round-trip the server per tap, stars that work, a heart on the page, Edit where you can see it, ticks that clear.
- **Cook mode.** Each step card shows the ingredients it mentions, durations in the text become timers, the next step is one line away.
- **The editor's way in.** Name first, text-first entry for ingredients and steps, a draft that survives the tab being killed, a quick edit from the page.

Not in this stage, and not to be re-raised without a decisions row: stored step-to-ingredient references (Mealie's linker; M26.1 computes the match, it does not store it, so row 22 stands), per-step times (Tandoor's `Step.time`), horizontal swipe in cook mode, Mealie's edit-in-place (row 40 stands; M27.5 is a per-row sheet, not the page in edit mode), a shopping list, and anything AI.

## M24 The column

- [x] **! M24.1 Two columns from `md`.** `/recipes/$slug`: the header spans the page; below it, from `md`, a grid with the ingredients in a sticky aside (`md:sticky md:top-6`, about a third of the width, its own scroll if taller than the viewport) and the parts' steps in the main column. The page widens to `max-w-5xl` from `lg`; the side nav is 224px, so it fits. Below `md` the stack stays as it is. Summary mode puts the one merged list in the aside; structured mode stacks each part's list there under its name, and the main column carries each part's name and steps. The print rules in `styles.css` keep working: selectors match the same `aria-label`s. Check: render tests asserting the aside holds every ingredient list and the main column every step list, in both ingredient modes; the print stylesheet test still passes.
- [x] **M24.2 Servings in the ingredients heading.** The aside gets a visible "Ingredients" `SectionTitle` and `ScaleControl` sits in that heading row, as Mealie's list header does; the loose row between the header and the list goes. `IngredientModeToggle` renders only when the recipe has more than one part, and its label becomes "One list", since a switch that says "Summary" over a flat recipe toggles nothing. decisions.md row. Check: a flat recipe renders no toggle; a two-part one does; the scale control is inside the heading row.
- [x] **M24.3 The header reordered.** `RecipeHeader` runs: image, name with the actions, stars, one strip holding prep, cook, total and yield, description, tags. Source, added and updated move out of the header into a `footer` at the foot of the page, under the timeline. "Last made" stays in the strip as text; the Made this button leaves the header (M25.6 gives it a home). Check: a test asserting the order of the header's children; the meta footer is the page's last element.
- [x] **M24.4 Notes before the ingredients.** Notes are the household's amendments, read before you start, so the Notes section moves from after the steps to directly under the header, above the grid, rendered as `Card`s as now. The editor's order follows (decision 50: the editor mirrors the page), so `NotesEditor` moves above `PartsEditor`. decisions.md row. Check: the section-order test that compares both routes is updated and passes.
- [x] **M24.5 Phone padding.** The recipe view, cook, new and edit pages go from `p-6` to `p-4 md:p-6`; `SaveBar` and `EditorToolbar` change their `-mx-6 px-6` bleed to match at each width. Check: render tests for the two bars at both widths still pass; a grep finds no `p-6` on a recipe route without the `md:` pair.
- [x] **M24.6 Ingredients from the method on a phone.** Below `md`, once the ingredient lists have scrolled off (an `IntersectionObserver` on the aside), a small fixed "Ingredients" button above the tab bar opens the current recipe's lists in a `sheet`: the merged list in summary mode, per-part lists in structured mode, the same `IngredientRow`s, so ticks are shared. Check: render tests for the sheet's content in both modes; a test that ticking in the sheet ticks the row on the page.

## M25 The controls

- [x] **! M25.1 Scale on the client.** `scaleRecipe` in `src/domain/scale.ts` is pure and already importable by the client. The view and cook loaders stop passing `servings` to `getRecipe` and the pages scale the stored document themselves from the search param, so plus and minus repaint without a request. The URL still carries `servings` and a refresh lands on the same scale. `getRecipe` keeps its `servings` parameter for outside callers. architecture.md's Scaling section is updated to say where it happens; decisions.md row. Check: a test that the page shows the same amounts `getRecipe({ servings })` returns for the same document; a test that stepping servings makes no server call.
- [x] **M25.2 "Scale to…" leaves the row.** The per-row link goes. The servings popover gains a second form under the number: pick an ingredient (a `Select` over the recipe's scalable ingredients) and type the amount you have, computing the servings through `servingsForTarget` as today. `data-testid="scale-to-trigger"` and its print rule go with the link. Check: no row renders the link; the popover form reaches `onScaleTo` with the right servings.
- [x] **M25.3 Stars that work.** `setRating({ id, rating })` in `src/server/recipes.ts` and the repository, `rating` 0 to 5 with 0 clearing to null. The header's `Rating` gets `onChange` through `useMutate`. `MadeThisSheet` gains the same stars above the comment, so the moment a cook is logged is a moment to rate it, as Tandoor's cook log does; saving the event writes the rating when it was touched. Check: a server test for the range and the clear; render tests for the header stars and the sheet's stars; a save with untouched stars writes no rating.
- [x] **M25.4 A heart on the page.** `FavouriteButton` moves out of `RecipeCard` into `src/components/ui/FavouriteButton.tsx`, and `RecipeHeader` renders it beside the actions, writing through `setFavourite` optimistically as the card does. Check: render test that toggling calls `setFavourite` and reverts on failure; the card still renders it.
- [x] **M25.5 Edit in the open.** Edit becomes an icon button beside Cook in the header's actions and leaves the menu, which then holds Duplicate, Copy link, Copy ingredients, Print and Delete. Both Edit and Cook links carry the current `servings`. Check: render test for the two visible buttons and the menu's items.
- [x] **M25.6 Ticks that clear.** `clearTicks` is called when a cook is logged (Made this, from the page or the finish card) and from a "Clear" link in the ingredients heading that shows only when anything is ticked. The Made this button lands in the timeline section's heading row, beside its own list; the finish card keeps its copy. Check: a test that logging a cook clears the recipe's ticks; the link is absent with nothing ticked and clears everything when pressed.

## M26 Cook mode

- [x] **! M26.1 The step's ingredients.** `src/domain/stepIngredients.ts`: `ingredientsInStep(text, ingredients)` returns the part's ingredients whose food name, plural name or alias appears in the step text, matched case-insensitively at word boundaries, longest name first so "brown sugar" does not also match "sugar", each ingredient at most once, in list order. Pure. The cook mode step card shows the hits under the step as chips, amount and food, ticking through the shared store like the ingredient card's rows; `StepRow` on the view page shows the same chips under the step below `md`, where the list is off screen, and not from `md`, where it is beside it. Check: a table test over aliases, plurals, the substring case, a step naming nothing, and a food named twice; render tests for the chips on both surfaces.
- [x] **M26.2 Durations in a step.** `src/domain/timers.ts`: `durationsIn(text)` returns every duration in a step with its offset and its seconds: "20 minutes", "20 min", "1 hour", "1½ hours", "1 hr 30 min", "30 seconds", "10-12 minutes" and "10 to 12 minutes" (a range keeps both bounds; the chip offers the lower). Pure. `Markdown.tsx` takes an optional decorator so the cook card and `StepRow` can render each match as a `TimerChip` inline in the text. Check: a table test per shape plus "2 eggs", "step 3" and "350 degrees", which are not durations.
- [x] **! M26.3 Running timers.** `src/lib/timers.ts`: a store in the shape of `ticks.ts`, `sessionStorage` keyed by recipe id, holding each running timer's label and absolute end time, so a reload or a card change does not lose it. Tapping a `TimerChip` starts one; running timers show as a strip above the cook footer with the remaining time, a pause and a dismiss, and on the view page above the tab bar. At zero: a `notify` with the step's text, `navigator.vibrate` where it exists, and the chip reads "Done" until dismissed. Check: tests over the pure store (start, tick, pause, expire, clear); a render test with a fake clock that a timer reaches zero and notifies.
- [x] **M26.4 Reading ahead.** Each step card ends with a one-line "Next: …" preview of the following card's first line (or "Finished"), dimmed, tappable to advance. "Screen on" in the header becomes an icon with a tooltip. Check: render tests for the preview on a middle card, the last card and the ingredients card.

## M27 The editor's way in

- [x] **M27.1 Name first.** `RecipeForm` opens on the name, autofocused on a new recipe only, with the image field moving below the description. Check: a render test asserting the field order and that a new recipe's name input has focus and an existing one's does not.
- [x] **! M27.2 Text-first ingredients.** An empty ingredient list does not say "No ingredients yet"; it renders a `Textarea`, "One ingredient per line", with **Add** running the bulk-add review inline in place of the textarea, exactly the rows `BulkAddSheet` shows, and Confirm landing the rows as it does today. Once the list has rows, the textarea goes and "Bulk add" stays in the header for adding more. The structured row is the correction view, not the entry view. decisions.md row. Check: render tests for the empty, reviewing and populated states; a test that a declined food still lands a text-only row.
- [x] **M27.3 Text-first steps.** The same for steps: an empty list renders a `Textarea`, "The method, a blank line between steps", and **Add** splits by `paragraphs` into rows. Check: render tests for the two states; a paste with three paragraphs lands three steps.
- [x] **! M27.4 A draft that survives.** `src/lib/drafts.ts`: a store in the shape of `prefs.ts`, `localStorage` keyed by the recipe id or `new`, written on every change while the form is dirty, cleared on save and on a confirmed discard. Opening the form with a stored draft that differs from `initial` shows a `Message` with **Resume** and **Discard** before the fields are touched. The picked image file is not stored; the notice says so when one was chosen. Check: tests over the pure store; render tests for resume and discard; a save clears the key.
- [ ] **! M27.5 Quick edit from the page.** An ingredient row or a step on the view page opens an edit `sheet` from a pencil in its row menu (long-press below `md`, hover from `md`): the editor's `IngredientFields` for an ingredient, a `Textarea` with the markdown preview toggle for a step. Save writes the whole document through `updateRecipe` with that one row changed and stays on the page; the units list is loaded when the sheet opens. Check: render tests for both sheets; a test that saving sends the full document with only that row changed and leaves ticks in place.
- [ ] **M27.6 Edit as JSON into a menu.** The toolbar's "Edit as JSON" button becomes an item in a `Menu` at the toolbar's end, leaving the toolbar with the name, the dirty note, Cancel and Save. Check: render test for the menu item and that the JSON view still opens and applies.

## Blocked

_(none)_

## Questions

- M24.6: there is no DOM test runner (no jsdom or testing-library), so "ticking in the sheet ticks the row on the page" is asserted at the store boundary (a subscriber fires and the page row re-renders ticked) rather than by clicking. Add a DOM environment for interaction tests? Default applied: no new dependency; the store-boundary assertion was accepted.
- M25.1: the same gap. "Stepping servings makes no server call" could not be asserted behaviourally, because without a DOM the router takes its server load path and re-runs every loader on `router.load()`. The test asserts the cache key instead: no `loaderDeps` on either route, match id and deps unchanged across the servings navigation, and a counted `getRecipe` mock that stays at one call through the load it can observe. Default applied: no new dependency; both questions stand as one decision for Jason.
- M27.4: the same gap a third time. Resume, Discard and the submit path cannot be clicked without a DOM, so the notice is asserted from server-rendered markup and the clearing is asserted against `clearDraft` at the store level. Default applied: no jsdom.

## Log

_(one line per iteration: date, task id, outcome, model)_

2026-09-12  M24.1  done  582ba02  opus  sticky ingredients aside and a method column from md, page widens at lg; print rules keep the aside via data-print="keep" and collapse the grid; PartSection split into PartIngredients and PartSteps. Pre-run dirty tree (RecipeCard aspect class) stashed as stash@{0}
2026-09-12  M24.2  done  b592e57  sonnet  ScaleControl and the mode toggle move into the aside's heading row under a visible "Ingredients" title; the toggle shows only for multi-part recipes and reads "One list". decisions.md row 60
2026-09-12  M24.3  done  ca60dc5  sonnet  header runs image, name with actions, stars, one strip of times, yield and last made as text, description, tags; madeAction prop gone; source, added and updated move into RecipeMetaFooter as the page's last element
2026-09-12  M24.4  done  dfe9fd3  sonnet  Notes sit between the header and the grid on the page and NotesEditor moves above PartsEditor in the form; the section-order test compares the new order. decisions.md row 61
2026-09-12  M24.5  done  9c993cd  sonnet  view, new and edit pages go p-4 md:p-6; EditorToolbar bleeds -mx-4 px-4 md:-mx-6 md:px-6 and SaveBar bleeds -mx-4 px-4 under its existing md reset
2026-09-12  M24.6  done  190f7fb  opus  a phone-only fixed Ingredients button (useScrolledOff, IntersectionObserver absent reads as scrolled off) opens IngredientsSheet over the same rows; IngredientList moves to its own file and ticks.ts gains a subscription so both copies of a row stay in step
2026-09-12  M25.1  done  8f6fdb4  opus  view and cook loaders drop the servings dep and read the stored document once; the pages apply the new pure scaledForServings from the search param, so − and + repaint without a request and the URL still carries the scale. decisions.md row 62, architecture.md Scaling updated
2026-09-12  M25.2  done  dd77a00  sonnet  the per-row Scale to link and its print rule go; the servings popover gains a Select over scalableIngredients (new in domain/scale.ts) plus a target amount, computing servingsForTarget
2026-09-12  M27.1  done  a08fdfc  opus  the image block moves below the description and a new recipe's name input is autofocused; the editor section-order test reordered to match. Cherry-picked from task/M27.1
2026-09-12  M26.1  done  a451f65  opus  ingredientsInStep matches a part's foods by name, plural or alias at word boundaries, longest first, each once; StepIngredientChips under the cook card's step and, below md, under the view page's step, ticking through the shared store. Cherry-picked from task/M26.1
2026-09-12  M25.3  done  331f2a8  opus  setRating server function and repository method (0 clears to null); the header's stars take onRate through useMutate and the Made this sheet carries stars above the comment, written only when touched. Cherry-picked from task/M25.3
2026-09-12  M25.4  done  ab21e99  sonnet  FavouriteButton, HeartIcon and toggleFavourite move to ui/FavouriteButton.tsx as a self-contained optimistic control; the card passes its overlay class through and the header renders it beside the actions. Cherry-picked from task/M25.4
2026-09-12  M27.2  done  fdccd46  opus  an empty ingredient list renders BulkInlineAdd (a textarea whose Add runs the bulk review inline) through a shared useBulkStage and BulkInlinePanel in BulkAddSheet.tsx, one ingredientReview and confirmReviewedIngredients for sheet and inline. decisions.md row 63. Cherry-picked from task/M27.2
2026-09-12  M25.5  done  8299059  sonnet  Edit is an outline pencil beside the solid Cook, both carrying servings; the menu keeps Duplicate, Copy link, Copy ingredients, Print and Delete; the edit route takes an optional servings so Cancel returns at the same scale. Cherry-picked from task/M25.5
2026-09-12  M26.2  done  e34bbe6  sonnet  durationsIn recognises minutes, hours and seconds with fractions, compounds and ranges; Markdown takes a decorate prop over its text runs and decorateDurations splices a presentational TimerChip into StepRow and the cook card. Cherry-picked from task/M26.2
2026-09-12  M27.3  done  9a8e18f  sonnet  BulkInlineAdd grows a no-review variant with its own placeholder and splitLines; an empty step list renders it with paragraphs as the splitter, calling addBulkSteps. Cherry-picked from task/M27.3
2026-09-12  M25.6  done  e9f2bfb  sonnet  anyTicked and useAnyTicked in ticks.ts; TimelineList gains a heading row holding Made this and renders even with no events; a logged cook clears the recipe's ticks and a Clear link in the ingredients heading shows only when anything is ticked. Cherry-picked from task/M25.6
2026-09-12  M26.3  done  18e9d46  opus  sessionStorage timer store keyed by recipe id (start, tick, pause, resume, expire, dismiss); chips show remaining time and Done; TimerStrip in the cook footer and fixed above the phone tab bar; expiry notifies (neutral intent, there is no info) and vibrates. Cherry-picked from task/M26.3 with one conflict resolved in the view route against M25.6
2026-09-12  M27.4  done  f35215e  opus  drafts.ts stores the dirty draft in localStorage under garnish.draft.<id|new>, validated on read with recipeInputSchema, written on every dirty change, cleared on save and confirmed discard; a Resume/Discard Message shows on mount when a stored draft differs, noting a lost picture. Cherry-picked from task/M27.4
2026-09-12  M26.4  done  bf65a8e  sonnet  pure nextPreview in domain/cook.ts and a dimmed tappable "Next: …" footer on every cook card; the header's Screen on text becomes an eye icon in a Tooltip. Cherry-picked from task/M26.4

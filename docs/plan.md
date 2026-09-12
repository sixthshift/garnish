# Plan

Implementation plan for garnish, stage 4 (the recipe editor), written to be executed one task per loop iteration with no human present. Decisions live in [decisions.md](decisions.md), shape in [architecture.md](architecture.md), boundaries in [scope.md](scope.md). Run it with `/ailoop` (see `.claude/skills/ailoop/SKILL.md`): one fresh subagent per task, the orchestrator verifies and records. This file is edited only by the orchestrator. Completed stages live in `docs/plans/`; stage 1 is [v1-foundations.md](plans/v1-foundations.md), stage 2 [v2-ui.md](plans/v2-ui.md), stage 3 [v3-parsing.md](plans/v3-parsing.md).

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


## Stage 4: The editor

Stage 2 shipped an editor that works and stage 3 taught it to parse. What neither did is ask what typing a recipe in actually feels like. `RecipeForm` is a metadata-first column — image, yield quantity, yield unit, "makes", prep minutes, cook minutes, rating — and you are six controls deep before the first ingredient. Mealie and Tandoor both put the recipe first and the paperwork behind it: Mealie by editing the view page in place, Tandoor by tabbing the meta away from the steps. Neither opens on a blank form if it can help it.

Three things this stage fixes, in order:

- **The way in.** The only path to a new recipe is an empty form. `parseIngredient` (M17.4), `paragraphs` (M13.4) and the review sheet (M17.5) are all built; nothing composes them over a whole pasted recipe. Decision 52.
- **The order.** The editor's shape should be the view page's shape, so nothing jumps when you switch and you can see what you are making. Decision 40 keeps the separate route; decision 50 makes the route mirror the page. Rating and last made leave the form entirely (decision 51).
- **The rows.** One unnamed part is the common case and it still renders a name field, a card and a reorder handle (decision 53). Every step carries four always-on buttons where both incumbents use one `⋮` (decision 54). Adding a row always costs a mouse trip (decision 55).

Not in this stage, and not to be re-raised without a decisions row: step-to-ingredient references (Mealie's ingredient linker), per-step times (Tandoor's `Step.time`), URL scraping, and anything AI — `claude -p` import stays Later in scope.md and will land on M19's review step when it comes.

## M19 The way in

- [x] **M19.1 Split a pasted recipe.** `src/domain/splitRecipe.ts`: `splitRecipe(text)` returns `{ title: string | null, ingredients: string[], steps: string[] }` — the opening line is the title when it reads like one, which is where M19.2's name comes from. Blank lines and a heading line (`Ingredients`, `Method`, `Steps`, `Instructions`, `You will need`, case-insensitive, optional trailing colon) divide the paste; with no heading, a leading run of short lines that `parseQuantity` finds an amount in is the ingredient block and the rest is steps. Numbered step prefixes (`1.`, `1)`, `Step 1:`) and list bullets (`-`, `*`, `•`) are stripped. Pure. Check: a table test over a headed paste, an unheaded one, a bulleted one, a numbered one, one that is ingredients only, and one that is prose only (everything lands in steps).
- [x] **! M19.2 The import screen.** `/recipes/new` opens on `RecipeImport`: a `Textarea`, "Paste a recipe", with **Continue** and a "Start blank" link. Continue runs M19.1, then `parseIngredient` per ingredient line, and shows the M17.5 review — `IngredientReviewRow` for the ingredients, a plain numbered list for the steps — with **Create** and **Back**. Create builds a `RecipeDraft` (name from the first line if it is not an ingredient, rows into the unnamed part) and hands it to `RecipeForm`; nothing is written until Save, except the foods and units the reviewer approved, through the existing `findOrCreateFood`/`findOrCreateUnit`. Check: render tests for the three states (paste, review, form); a test that Start blank reaches the form with `emptyDraft()`; a test that a declined food lands a text-only row.
- [x] **M19.3 Paste into an open recipe.** The same sheet from an existing recipe's editor: the part header's "Bulk add" grows a sibling that takes a whole block and appends to both lists at once. `RecipeImport`'s review component is reused; only the commit differs (append to part `pi` rather than build a draft). Check: render test over a mixed block; the rows land in the right part.

## M20 The order

- [x] **M20.1 Details disclosure.** `RecipeForm` splits in two: the always-visible head (image, name, description, servings) and a `Details` disclosure holding yield, prep and cook times, tags and source URL. Closed on a new recipe, open when any field inside it is set. Built from the design system's pieces under `src/components/ui/` if it has no disclosure. decisions.md row 50. Check: render tests for both initial states; a test that a field inside a closed disclosure still validates and still saves.
- [x] **M20.2 Rating and last made leave the form.** `RecipeDraft` keeps the fields (the document carries them) but `RecipeForm` stops rendering the `Rating` control and any last-made input; both are already set from the view page and the timeline (decision 41). decisions.md row 51. Check: the form renders no rating control; an edited recipe round-trips its existing rating through Save untouched.
- [x] **M20.3 Editor order mirrors the view.** The form's sections run in the view page's order — head, parts (ingredients then steps), notes, details — and the parts section drops the "Parts" heading, as `/recipes/$slug` does. decisions.md row 50. Check: a test asserting the section order of both routes matches.

## M21 The rows

- [x] **M21.1 The unnamed part loses its chrome.** When a recipe has exactly one part and it is unnamed, `PartsEditor` renders its two lists directly under "Ingredients" and "Steps" — no name input, no card border, no reorder handle, no "Parts" heading. "Add part" reveals the chrome on every part, including that one, and names it nothing. decisions.md row 53. Check: render tests at one unnamed part, one named part and two parts; adding a part to a bare recipe keeps the first part's rows.
- [x] **M21.2 Step actions into a menu.** `StepsEditor`'s four inline buttons become one `Menu` (`src/components/ui/Menu.tsx`) per row: insert above, insert below, split by paragraph, merge with next, delete. Split-all and merge-all join "Bulk add" and "Add step" in the section header, operating over every step in the part. decisions.md row 54. Check: render test that a step row has one menu trigger and no inline action buttons; split-all over a part with two multi-paragraph steps.
- [x] **M21.3 Parse all.** When no ingredient in a part resolves to a food, the ingredient list heads with a `Message` offering **Parse all**, which runs M17.6's parse over every text-only row in the part and reviews them in one sheet. The banner disappears once any row has a food. decisions.md row 54. Check: the banner shows on an all-text part and not on a mixed one; confirming applies every approved row and leaves declined rows text-only.
- [x] **M21.4 Keyboard append.** Enter in an ingredient row's last field, or in a step's textarea with the cursor at the end and the modifier held, appends a row to that list and focuses its first field — `event.preventDefault()` so the form is not submitted. Only from the last row; from any other row Enter moves to the next. decisions.md row 55. Check: fireEvent tests for append-and-focus on the last row and move-to-next on an earlier one; a test that the form does not submit.
- [x] **M21.5 Create from the combobox.** Typing an unknown food or unit and pressing Enter accepts the typed name as a new reference, as Mealie's "press enter to create" does, rather than needing the value picked from the list. The reference is still resolved on save by the repository's find-or-create; nothing is written while typing. Check: typing a name nobody has and pressing Enter puts a reference with that name on the row and calls no server function.

## M22 Polish

- [ ] **M22.1 Step markdown preview.** Each step row's menu gains a preview toggle, rendering `Markdown.tsx` over the step's text in place of the textarea. decisions.md row 56. Check: render test toggling one row into preview and back, leaving the other rows editing.
- [ ] **M22.2 Sticky editor toolbar.** The editor gains a header that stays put while the form scrolls: the recipe's name, the dirty note, "Edit as JSON" and the Save/Cancel pair `SaveBar` holds today. `SaveBar` keeps its phone-footer role or is folded into the toolbar, whichever reads better at both widths. Check: render tests at both widths; the blocker and dirty state still behave.

## Blocked

_(none)_

## Questions

_(none)_

## Log

_(one line per iteration: date, task id, outcome, model)_

2026-09-12  M19.1  done  —  opus  splitRecipe takes a title off the front, then splits on headings where the paste has them and on line shape where it does not; bullets and numbered step markers are stripped from both lists
2026-09-12  M19.2  done  —  opus  /recipes/new opens on a paste box; Continue splits, parses and reviews, Create writes only the approved vocabulary and hands RecipeForm a draft, and Start blank navigates to ?blank so the empty editor keeps a URL
2026-09-12  M19.3  done  —  opus  a Paste button in each part's ingredient header opens the same two stages in a sheet; PastePartSheetContent is the testable body, and Add appends the rows and the steps to that part after what was there
2026-09-12  M20.1-3  done  —  opus  one pass over RecipeForm's body: a <details> Disclosure holds yield, times, tags and a new source field and opens itself when any is set; the Rating control is gone (row 51); the sections now run image, name, servings, parts, notes, details, matching the view page
2026-09-12  M21.1  done  —  opus  isBare drops the name field, card, heading and reorder handles for a one-part unnamed recipe; Add part is the way out and gives every part its chrome back
2026-09-12  M21.2  done  —  opus  one ⋮ per step carries insert above/below, split, merge with next and delete; splitAllSteps and mergeAllSteps join Bulk add and Add step in the section header, each disabled when it would do nothing
2026-09-12  M21.3  done  —  opus  a part with no resolved food heads its ingredient list with a Parse all banner; the sheet reads every text-only row through parseIngredient, keyed by row position, and Apply patches only what was approved
2026-09-12  M21.4  done  —  opus  rowEnter decides append-or-next and focusNamed does the focusing; Enter on an ingredient row's last field and ⌘/Ctrl+Enter in a step's textarea both preventDefault so the form is never submitted
2026-09-12  M21.5  done  —  opus  enterChoice is the Combobox's Enter rule: open, plain autocomplete; closed, the exact option or the typed name as a new reference, so Enter never reaches the form. Nothing is written while typing — the repository still find-or-creates on save

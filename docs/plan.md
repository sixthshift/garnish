# Plan

Implementation plan for garnish, stage 3 (ingredient parsing), written to be executed one task per loop iteration with no human present. Decisions live in [decisions.md](decisions.md), shape in [architecture.md](architecture.md), boundaries in [scope.md](scope.md). Run it with `/ailoop` (see `.claude/skills/ailoop/SKILL.md`): one fresh subagent per task, the orchestrator verifies and records. This file is edited only by the orchestrator. Completed stages live in `docs/plans/`; stage 1 is [v1-foundations.md](plans/v1-foundations.md), stage 2 [v2-ui.md](plans/v2-ui.md).

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

## Stage 3: Ingredient parsing

The core gap stage 2 left: nothing turns a typed or pasted line into `quantity` / `unit_id` / `food_id`. Bulk add (M13.4) commits text-only rows and they stay that way, so they never scale, never merge in Summary mode, never match the food filter and never count in `usingFood()`. Decision 47 settles the approach: a pure rules-based matcher over the vocabulary already in the `unit` and `food` tables, no AI, with a review step before any row is created. No schema change — `ingredient` has carried the columns since 001.

`src/domain/format.ts`'s `formatIngredient` is the exact inverse of this work; M17.4 gates on the round trip.

## M17 The parser

- [ ] **M17.1 Quantities.** `src/domain/parseQuantity.ts`: `parseQuantity(text)` returns `{ quantity, fixed, rest }`. Handles integers, decimals, `1 1/2`, `3/4`, the vulgar glyphs `format.ts` emits (`½`, `1½`), `a`/`an` as 1, a leading `=` as `fixed` (Cooklang), and a range (`1-2`, `1 to 2`) taking the low value as Mealie does. No leading number: `quantity` null and `rest` is the line unchanged. Check: a table test per form, including `=`, both range spellings and every glyph in `VULGAR_FRACTIONS`.
- [ ] **M17.2 Units.** `src/domain/parseUnit.ts`: `parseUnit(rest, units)` matches the leading token(s) against each unit's `name`, `pluralName` and `abbreviation`, case-insensitively, longest match wins. A static alias map covers what the seed does not carry (`T`/`tbs`/`tblsp` → tablespoon, `t` → teaspoon, `grams`/`gr` → gram, `mls` → millilitre). No match: null unit, the token stays in `rest` for the food. Check: match by each of the three fields, the alias map, longest-match ("fluid ounce" over "ounce") and a no-match line.
- [ ] **M17.3 Foods and notes.** `src/domain/parseFood.ts`: splits the remainder on the first comma — head is the food candidate, tail the note — and lifts any parenthetical (`(about 400 g)`) into the note too. Matches the head against `name`, `pluralName` and every entry in `aliases`, case-insensitive, longest match wins. Unmatched leading words stay part of `foodText` rather than being dropped, so "plain flour" proposes "plain flour", not "flour". Check: match by plural and by alias, longest-match over two candidate foods, comma note, parenthetical note, and the unmatched-adjective case.
- [ ] **! M17.4 `parseIngredient`.** `src/domain/parseIngredient.ts` composes M17.1–M17.3: `parseIngredient(line, { units, foods })` returns `{ quantity, fixed, unit, unitText, food, foodText, note, originalText }`. Pure, no ids invented and no rows created — a miss returns the text it could not resolve, and resolution is the caller's job. Check: end-to-end cases ("2 cups plain flour, sifted", "=1 tsp salt", "salt, to taste", "½ bunch coriander, chopped"), plus the round-trip property test — for every ingredient in the seed corpus, `parseIngredient(formatIngredient(row))` recovers that row's quantity, unit and food.
- [ ] **! M17.5 Bulk add review.** `BulkAddSheet` on ingredients stops committing text-only rows: it parses each line through M17.4 and shows the result for review — matched food and unit as chips, unmatched ones flagged with "create" or "pick existing" (reuse `Combobox`). Confirm commits the rows and creates only the approved foods and units, through the existing `findOrCreateFood` / `findOrCreateUnit` server functions. `originalText` keeps the raw line either way. Check: render test over a mixed paste (one fully matched line, one unknown food, one text-only line); a test that declining "create" leaves the row text-only and adds no food.
- [ ] **M17.6 Parse a single row.** A text-only ingredient row gains a "Parse" action — in the row menu inline, as a button in the phone `sheet` (M13.2) — running the same function over `originalText` and filling the fields in the draft, with the same confirm-before-create rule for an unknown food. Applies to rows already saved, so an old recipe can be fixed as you open it. Check: render tests at both widths; the action fills the draft and leaves `originalText` intact.

Deferred here on purpose, not to be re-raised without a decisions row: fuzzy (edit-distance) food matching, and learning from a correction. Both are where Mealie's parser gets complicated and neither earns its place until the plain matcher has been lived with. Backfilling the text-only rows already in the database is left to M17.6, one row at a time.

## Blocked

_(none)_

## Questions

_(none)_

## Log

_(one line per iteration: date, task id, outcome, model)_

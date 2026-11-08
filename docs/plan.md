# Plan

What is next for garnish, written to be executed one task per loop iteration with no human present. Decisions live in [decisions.md](decisions.md), shape in [architecture.md](architecture.md), boundaries in [scope.md](scope.md), and the plans not yet decided in [ux-review.md](ux-review.md). Run it with `/loop` or by hand, one task at a time.

Stages 1 to 15 (M0 to M52) are done. Their task lists, questions and log were cleared on 2026-11-08; they are in the git history (`git show 0b1b46c:docs/plan.md`, and `docs/plans/` before that), and every decision they settled is a row in decisions.md.

## Loop protocol

What one task looks like, whoever runs it (a /loop firing or a person):

1. Read this file. Read `CLAUDE.md`. Do not re-read the other docs unless a task points at them.
2. Pick the first unchecked task whose dependencies are checked. Milestones run in order; tasks within a milestone run in order unless marked `∥`.
3. Do that one task. Nothing else. No drive-by refactors, no adjacent tasks.
4. Verify with the task's own check. Then run the full gate:
   ```
   bun run check     # tsc --noEmit
   bun run test      # vitest run
   bun run lint      # biome check .
   bun run e2e       # Playwright over the production build
   ```
   All four must pass. A failing gate is not done. Fix it or revert the task.
5. Commit with a one-line message naming the task id, e.g. `M1.3 recipe document schema`. Attribution trailer per `CLAUDE.md`.
6. Report: tick the task and append the Log line.
7. Stop. One task per iteration.

Rules:

- **Blocked?** Write the blocker under Blocked with the task id and what you tried. Move to the next task that does not depend on it. Never guess past a blocker on a decision; guess freely on implementation detail, and when unsure copy Mealie.
- **Question for Jason?** Write it under Questions. Pick the Mealie answer and continue. Do not stop.
- **Found a design gap?** Add a row to `decisions.md`; if it replaces an earlier row, remove that one and repoint what cites it. Note it in the Log.
- **Framework questions?** TanStack Start docs at https://tanstack.com/start/latest. Server functions (`src/api/rpc/`) for app calls; server routes only for `/api/*`, in a section's `routes/api/` or the app's `src/api/rest/`. SPA mode stays on.
- **UI element needed?** Check the design system's exports first (`node_modules/@sixthshift/design-system/package.json`). Build locally only if absent, under `src/components/ui/`.
- **Task too big for one iteration?** Split it in place into `Mx.y.a`, `Mx.y.b`. Do the first part.
- **Tests:** every pure function and every API route gets tests in the same task that creates it. No task is done with a TODO test.
- **No new dependencies** beyond `package.json`'s without a decisions.md row saying why.

## Tasks

_(none: the next stage is written here when it is chosen, as `## Mxx Title` with `- [ ] **Mxx.y Name.**` tasks)_

## Blocked

_(none)_

## Questions

Open questions carried over from the finished stages, each Jason's call:

- The house style: statements alone, or statements plus exemplars (a few hand-edited recipes passed alongside the ticked rules)? Waiting for a recipe the statements cannot get right (decisions row 92).
- The restyle: should the model answer each step's ingredient rows, so Apply writes those links rather than `suggestLinks` guessing from text? A bigger change to the answer schema, the check and the sheet.
- The import: keep the JSON-LD a recipe was made from (`recipe.import_source`), so a better prompt or model can re-sort it later without fetching again?

## Log

```
date        task   result  commit   model  notes
```

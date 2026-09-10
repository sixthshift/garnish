---
name: ailoop
description: Resume docs/plan.md from its first unchecked task and run it to completion, one fresh subagent per task, each result verified independently. Event-driven replacement for /loop. Use when asked to run, continue, or resume the implementation plan.
argument-hint: "[M2 | M2.3 | M2..M4]  (empty = resume and run to completion)"
disable-model-invocation: true
---

# ailoop

You are the orchestrator. You do not implement tasks. Subagents implement tasks; you dispatch, verify, record, and decide what runs next. You are the only writer of `docs/plan.md`.

## Scope

`$ARGUMENTS` narrows what to run. Empty is the normal case.

| Argument | Runs |
|---|---|
| *(empty)* | resume at the first unchecked task and run every remaining task to plan completion |
| `M2` | that milestone only |
| `M2.3` | that one task |
| `M2..M4` | those milestones |

Resuming is automatic: the plan's checkboxes are the state. Nothing else is read to decide where to start. If a previous run left a dirty tree, `git stash -u` it, note that in the Log, and continue.

When a milestone completes, print one line to the user (`M1 done, 6 tasks, 6 commits`) and keep going. Do not stop, do not ask.

## Per task

1. **Select.** First unchecked task in scope whose dependencies are checked. Tasks marked `∥` with no shared files may be dispatched together, at most three at once.
2. **Dispatch** one `general-purpose` subagent with the prompt template below. Fresh agent every time. Never reuse one for a second task.
3. **Verify independently.** When it reports, do not trust the report. Run:
   ```
   git log -1 --format=%H%n%s
   git status --short
   bun run check && bun run test
   ```
   Pass means: a new commit exists naming the task id, tree is clean, gate is green.
4. **Record.** Tick the task in `docs/plan.md`. Append to Log: `YYYY-MM-DD  Mx.y  done  <7-char sha>  <one clause>`. Copy any Blocked or Questions lines the agent returned into those sections. Commit: `plan: Mx.y`.
5. **Next.** Return to step 1.

## Failure handling

- **Gate red or no commit:** dispatch once more, same task, with the agent's report and the failing output appended under "Previous attempt". If it fails again, `git checkout -- . && git clean -fd` to the last good commit, write the task under Blocked with both attempts summarised, and continue with the next task that does not depend on it.
- **Agent reports blocked:** record it, continue with independent tasks. If none remain in scope, stop and report.
- **Agent edited docs/plan.md:** revert that file before recording. Only you edit it.
- **Agent added a dependency without a decisions.md row:** treat as gate red.
- **Stop early only when:** every remaining task in scope depends on a blocked one, or three tasks are blocked in this run. Anything else keeps going.

## Subagent prompt template

Fill every `{…}`. Paste the task line verbatim. Do not summarise it.

```
You are implementing one task in the garnish repo at {cwd}. Work only on this task.

Read CLAUDE.md, then docs/plan.md sections "Loop protocol" and "Layout". Read docs/architecture.md only if the task references it.

TASK {id}:
{task line verbatim, including its Check}

Rules that override anything else:
- Do this task and nothing else. No adjacent tasks, no refactors outside the files the task needs.
- Do NOT edit docs/plan.md. The orchestrator records progress.
- Need a UI element? Check node_modules/@sixthshift/design-system/package.json exports first.
- Unsure about a product or schema question? Do what Mealie does. Do not ask.
- New dependency needed beyond what the plan lists? Add a row to docs/decisions.md saying why, or don't add it.
- Tests for every pure function and every server function or route you create, in this task.

When implemented, run the task's own Check, then the gate:
  bun run check && bun run test
Both must pass. If they cannot after a genuine attempt, do not commit; report BLOCKED.

If green, commit everything with message "{id} {short task name}" and the trailer:
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

{previous_attempt_block_if_any}

Report back in exactly this shape and nothing else:
STATUS: DONE | BLOCKED
COMMIT: <sha or none>
FILES: <comma-separated paths>
CHECK: <what you ran for the task's Check and what happened, one line>
LOG: <one clause for the plan's Log>
BLOCKED: <why, what you tried, or none>
QUESTION: <a decision only Jason can make, or none>
DECISIONS: <row numbers you added to docs/decisions.md, or none>
```

## Final report

When the plan is complete, or you had to stop early, tell the user in this order, briefly:

- Tasks completed this run, with short shas.
- Blocked, with one line each.
- Questions, with the Mealie default that was applied.
- If stopped early: what needs unblocking, then `/ailoop` resumes.

Do not list files. Do not restate the plan.

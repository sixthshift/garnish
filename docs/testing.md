# Testing

Three layers, and one rule for choosing between them: test at the lowest layer that can see the failure. The gate is all of them — `bun run check`, `bun run test`, `bun run lint` and `bun run e2e` — and CI runs the same four before an image is built (`.github/workflows/docker.yml`).

| Layer | Runs | Proves | Where | Command |
|---|---|---|---|---|
| Unit | vitest, `node` project | a function, a repository, a component's markup | `test/` mirroring `src/` | `bun run test` |
| Integration | vitest, `node` and `dom` projects | the pieces together in-process: server functions on a real migrated database, a page through the real route tree and its loaders, a component driven by a click | `test/` mirroring `src/` | `bun run test` |
| E2E | Playwright, Chromium, a phone viewport | the build itself: the production bundle, served the way the image serves it, in a real browser | `e2e/` | `bun run e2e` |

`bun test` is Bun's own runner and will not work; vitest is always reached through the script (decisions.md row 33).

## Unit

Pure logic gets plain `test`/`expect`, no setup. Most of `test/domain/` and `test/lib/` is this.

A repository is tested over its own handle, the factory it exports for exactly this (decisions.md row 88): an in-memory database, migrated, per test.

```ts
let repo: AisleRepository;
beforeEach(() => {
  const db = openDatabase(":memory:");
  migrate(db);
  repo = aisleRepository(db);
});
```

A component whose test only reads what it renders stays in the `node` project and renders with `renderToString`. No DOM is the point: a component that touches `window` while rendering fails here, as it would on the server.

A model is never called. `fakeAi` (`test/helpers/ai.ts`) answers from a fixture and records what it was asked; the import's pipeline takes its page fetch and its model as ports, so the whole `Importer` runs with two fakes. `vitest.env.ts` clears every AI variable before each file, so a developer's `.env` cannot make a test ask a real model.

## Integration

**Server functions** run their real handler against a real database in a temp `DATA_DIR`:

```ts
useTempDataDir();                                   // a fresh migrated database per test, at file top level
const recipe = await callServerFn(createRecipe, draft);
```

`useTempDataDir({ starterFoods: true })` gives the database a real first start makes, with its 750 foods; without it a test sees only what it creates. Both live in `test/helpers/server.ts`, which explains why `callServerFn` is needed (vitest has no server-function manifest).

**Pages** render through the real route tree with their loaders: `renderRoute(path)` from `test/helpers/routes.tsx`, or `testRouter(path)` to navigate before rendering. The loaders' server functions are made to run in-process with `runLocally`:

```ts
const local = async (importOriginal) => {
  const { runLocally } = await import("../../helpers/server");
  return runLocally(await importOriginal());
};
vi.mock("../../../src/server/fns/plan", local);
```

**Interactions** are driven, not read (decisions.md row 95). A file named `*.dom.test.tsx` runs in the `dom` project — happy-dom, Testing Library, `user-event`, `jest-dom` — and `renderInRouter` (`test/helpers/dom.tsx`) mounts a component with enough router for a `Link`. Name a file `.dom.test.tsx` only when it presses something; a DOM for a file that only checks markup costs the whole suite.

**Contracts** on text the app does not run — the Dockerfile, the compose file, the workflow, the PWA manifest, the module boundaries (`test/modules.test.ts`), the schema against its migrations (`test/db/drift.test.ts`) — are asserted as tests too, so a change to one says what it breaks.

## E2E

`e2e/playwright.config.ts` builds the app, starts `.output/server/index.mjs` on port 9989 over an empty `DATA_DIR` (`$TMPDIR/garnish-e2e`, left in place after a run so a failure's database can be opened), and drives it in Chromium as a Pixel 7. The server is started with `--no-env-file` and no `AI_PROVIDER`, so the specs see the app without a model whatever the developer's `.env` says. It never reuses a running server.

Every spec imports from `e2e/fixtures.ts`, not `@playwright/test`:

- **`page` fails the test on any uncaught error or console error.** Every journey is also a check that nothing on its way threw. A test that expects one names it: `test.use({ allowedErrors: [/status of 404/] })`.
- **`open(path)`** navigates and waits for a quiet network. The server sends a prerendered shell that React hydrates as the route's chunks arrive; typing before that finishes is thrown away with the mismatched DOM (React #418). Navigate with `open`, not `page.goto`.
- **`createRecipe(page, open, recipe)`** types a recipe in through the editor and resolves on its page — the setup most journeys need.
- **`unique(name)`** suffixes a name. The specs share one database, so each makes what it reads unique.

The specs run on one worker, in one database: the backup spec restores, which replaces everything. Select by role and accessible name (`getByRole("button", { name: "Create recipe" })`), never by class or test id; a selector that cannot find its element by name is usually an accessibility bug.

What belongs here, and what does not:

- `smoke.spec.ts` — every page loads cold with its heading and no error. A new page adds a row to its list.
- One spec per journey the household relies on: typing in and editing a recipe, planning a week into a shopping list, backing up and restoring. A new one earns a spec when its failure would not show in vitest, because it crosses the build, the browser, or more than one page.
- Not edge cases, validation messages, or one component's states: those are cheaper and clearer in vitest.

On failure, `test-results/` holds a screenshot and a trace for each failed test (`bunx playwright show-trace <trace.zip>`); in CI both are uploaded as the `playwright-report` artifact.

Playwright's Chromium is installed once per machine: `bunx playwright install chromium`. The version is pinned exactly in `package.json`, since each release wants its own browser build.

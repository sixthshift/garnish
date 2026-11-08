# garnish

A personal recipe manager. Single household, runs on the LAN; the one public door is the MCP connector, behind OAuth (decisions.md row 181).

## Docs

- [`docs/intent.md`](docs/intent.md) — why, and what it refuses to do
- [`docs/architecture.md`](docs/architecture.md) — stack, data model, scaling, API, persistence rules
- [`docs/decisions.md`](docs/decisions.md) — decision log; add a row to reverse one, don't edit
- [`docs/scope.md`](docs/scope.md) — v1, later, open, never
- [`docs/development.md`](docs/development.md) — running it: scripts, environment, the labs, releases
- [`docs/plan.md`](docs/plan.md) — the loop protocol, the next tasks and the open questions; finished stages are in git history
- [`docs/ux-review.md`](docs/ux-review.md) — the second UX pass over the four modes: plans being refined, not yet decided
- [`docs/design-language.md`](docs/design-language.md) — the six rules for how it looks, and the divergences from the design system
- [`docs/testing.md`](docs/testing.md) — unit, integration and e2e: which layer a test belongs in, and the helpers for each

Keep the argument in `docs/`; keep operating constraints here.

## Constraints

- **Store:** SQLite via `bun:sqlite` is the only store. Recipes are mastered in the DB. Backup and restore are the whole database and a restore replaces it; export and import are one recipe and an import only adds (decisions.md row 131).
- **Queries:** Drizzle ORM over that same `bun:sqlite` handle (decisions.md row 46). `src/db/models/` is one folder per domain: `schema.ts` declares that domain's tables, `repo.ts` is its repository: it exports the factory by name (`tagRepository(db)`: a constructor in all but syntax, for tests and the CLIs, which bring their own handle; decisions.md row 88) and the repository over the application database as its default export (`import tags from "…/tag/repo"; tags.list()`), which is what server code uses — server code never calls `getDb()` itself (decisions.md row 87). No barrel — repositories import the tables they touch directly. Repositories use the query builder, not SQL strings. `src/db/migrations/*.sql`, applied by `src/db/migrations/migrate.ts`, still build the database — drizzle-kit only *generates* SQL to review (`bun run db:generate`), it never applies it.
- **Modules:** `src/domain/` is the app's sections — `home/`, `plan/`, `shopping/`, `recipes/` — and each holds its logic as modules one level down, beside its screens: `recipes/` (recipe, ingredient, reference, draft, import, style, cooking), `plan/` (plan, planner), `home/home`, `shopping/shopping`. Settings is not a section but a feature of the app itself, `src/app/features/settings/`, with the same `pages/`, `components/` and `routes/`, and its logic in `model/`, a module a folder: `model/backup`, the backup's format, which the server and the db import as expecting's db imports its settings' model. A module is a folder with an `index.ts`; a section's `pages/` (one file per page, `PlanPage.tsx`), `components/` (the React parts only that section uses) and `routes/` (its addresses) are not modules, and no module imports them, `app/`, `routes/` or `components/` (`test/modules.test.ts`). Its `index.ts` is its only entry: it exports a chosen surface, not everything the folder has, and nothing outside the folder imports a deeper path (`test/modules.test.ts` enforces it). This is not a barrel, and the no-barrel rule for `src/db/models/` stands. Dependencies run one way (reference ← ingredient ← recipe ← shopping ← plan, and planner ← plan, since the plan labels an entry with the meal the planner owns; draft, import, cooking, backup (`src/app/features/settings/model/backup`) and home sit on top; style alone); never make two modules import each other. `import`'s surface is an `Importer` object — `new Importer(ports).import(source)` — that chooses the sequence for a URL, a paste or a file, with the page fetch and the model as injected ports so the whole pipeline runs in a test with two fakes. The recipe editor's model is `src/domain/recipes/draft/`; its screens are `src/domain/recipes/components/editor/`. `src/lib/` holds generic utilities (id, lists, numbers, dates, urls, errors, search, zip, storage) and the browser plumbing more than one section shares (the shopping outbox, timers and ticks, push, voice, the wake lock, preferences), and, in `lib/ui/`, the logic behind the generic primitives; what one section alone uses lives in that section, and a pure function that serves one component stays in that component. `src/lib/` never imports anything that renders (`test/modules.test.ts`), and a domain module may import a lib file only if it is a library, one that imports nothing of the app.
- **Schema:** Mealie's shapes outside recipe internals, minus users and groups. `https://demo.mealie.io/openapi.json` is the reference.
- **Tie-breaker:** when unsure about any product or schema question, do what Mealie does.
- **Recipe internals:** a recipe is an ordered list of named parts; each owns its ingredients and its steps, and the unnamed part (`name = ''`) is the recipe's main body. Sub-recipes hang off `food.recipe_id`: a row whose food is made by a recipe links to it and derives the child's servings from the row's amount (`subRecipeScale`, decisions.md row 70). One level only, and a parent follows its child's edits live; neither is to be extended (decisions.md row 130).
- **Auth:** none in the app. No users table, no sessions. The MCP connector alone is behind OAuth 2.1 (`src/server/mcp/`, decisions.md row 181): the consent page asks for the pairing code garnish makes itself (Settings › MCP, replaced on every Allow), and what it lets in is a client, never a person.
- **AI:** optional, and the app works without it. `AI_PROVIDER` chooses the provider (`api`, any OpenAI-compatible endpoint, or `claude-code`, a subscription through the Agent SDK), with no default; each use's model (import, restyle, planner, cooking assistant) is chosen in Settings › AI and nowhere else (decisions.md row 217). Every model answer is validated into the same documents the editor saves, and a screen offers a model only when one is available (`src/server/ai/`).
- **Framework:** TanStack Start (React 19). Routing is code, not file names, laid out as in expecting: each section has a `routes/` folder of definitions only, nested as their paths are — a file per route, named for its own path within the section, exporting its `createRoute` by name with its search schema (`validateSearch` on the leaf that owns it), its loader and its page from the section's `pages/` via `lazyRouteComponent`. A section with several routes has a path-only route (`src/domain/plan/routes/plan.ts`, `path: "plan"`, no component, so nothing wraps its pages), its pages as children (`planIndex.ts` at `/`, `fill.ts`), and an `index.ts` that puts its subtree together (`planRoutes`; `recipesRoutes` puts `recipesIndex.ts` and `new.ts` under `recipes.ts`, and nests `recipe.ts` at `$slug` over `recipeIndex.ts`, `edit.ts`, `style.ts`, `review.ts`); one route alone needs no `index.ts` (`home`, `shopping`, and settings' `src/app/features/settings/routes/settings.ts`). Loaders stay on the leaves. `src/routes/` keeps only `root.tsx` (the root route, which keeps the export name `Route` because Start's generator owns it, drawing `Document` and `Root`) and `tree.ts` (the subtrees in the nav's order, and nothing else). A route's id is its path, an index's ending in `/`: a page reads its route through `getRouteApi("/plan/")`, and nothing imports a route but other routes and `tree.ts` (`test/modules.test.ts`). Server routes (`createRoute` with `server.handlers`) sit with their owner too, in its `routes/api/` (`src/domain/recipes/routes/api/`: export, images, the import of one file; `src/app/features/settings/routes/api/`: backup, restore, the library import), and the app's own in `src/api/rest/` (health, the MCP connector and its OAuth door, as in expecting), whose `index.ts` (`restRoutes`) is the one list `tree.ts` adds on the server only. A route file only wires a path to its handler; the Request-to-Response handlers themselves are in `src/server/api/`, where a test calls them directly; nothing but the tree and another server route imports one (`test/modules.test.ts`). A component only one section's pages use sits in that section's `components/` (`domain/recipes/components/editor/` is the editor); `src/components/` keeps only what unrelated sections or the shell share. `src/app/` is the app itself, not a domain: `pages/` (`Document`, `Root`, `RouteStates`), `components/layout/` (`AppShell`, the shared nav), `model/` (no React) and `features/` (what is the app's rather than a section's: `settings/`). Start's generator still runs for its asset manifest (root only, output gitignored under `.tanstack/`); nothing imports it. No `createFileRoute`. Vite is its build tool, run via `bun --bun vite`. This overrides the generic Bun guidance below about HTML imports and avoiding Vite. Server functions (`createServerFn`, one file per resource in `src/api/rpc/`, as in expecting) for the app's own data calls; server routes only for `/api/*` endpoints that outside callers need (health, images, import, the MCP connector and its OAuth server), plus the two OAuth metadata documents RFC 9728 and 8414 fix under `/.well-known/`.
- **Rendering:** SPA mode (`spa.enabled`), in production as in dev: every page request gets the shell — the document, the frame, the pending spinner — and the browser draws the page (`src/server/shellMode.ts` sets `TSS_SHELL`, imported first in `src/server.ts`; decisions.md row 169). No SEO need; the PWA shell caches cleanly. The shell reads the same for every address, since offline one cached copy answers them all: anything the address decides in the root waits for `useHydrated` (`src/lib/useHydrated.ts`). Pages are not drawn on the server; don't give a route `ssr`.
- **Frontend:** React 19 + Tailwind 4 via `@tailwindcss/vite`. Phone-first PWA. Adaptive (decisions.md row 206, as expecting): two experiences split at 64rem, a phone's (tab bar) and a desktop's (top bar, side panel). `useLayout()` (`src/lib/useLayout.ts`) chooses where the structure differs, never drawing both and hiding one; the `mobile:` and `desktop:` variants for spacing; no `md:` or `lg:` (a test keeps them out); what is only one layout's lives in `mobile/` or `desktop/` beside what it splits, neither importing the other. A desktop's width goes on more columns, not longer lines (row 207): each desktop page is its own design, from `docs/mockups/desktop.html`. A phone's pages are designed for a hand (row 208): the thumb's half, sheets from the bottom, `SwipeRow` as a shortcut only. See `docs/architecture.md`, Frontend › Adaptive.
- **UI kit:** `@sixthshift/design-system` (Jason's personal system). Subpath imports only, e.g. `@sixthshift/design-system/button`. Check its exports before writing any UI element. Missing primitives are built locally from its pieces.
- **Locale:** metric, en-AU spelling. UUID ids, zod validation, images on disk.
- **Tests:** vitest via `bun run test`. Not `bun test`. `bun run check` (tsc) and `bun run lint` (Biome, a11y included) are part of the gate too. Two projects in one command: everything runs in `node` and renders with `renderToString`, except `*.dom.test.tsx`, which gets happy-dom and Testing Library so an interaction can be driven. Name a file `.dom.test.tsx` only when it presses something; a DOM for a file that just checks markup costs the whole suite. `bun run e2e` is the third layer and part of the gate: Playwright over the production build, specs in `e2e/` importing `e2e/fixtures.ts` (not `@playwright/test`), navigating with `open`, selecting by role and name (decisions.md row 168).
- **Deploy:** one Docker container, SQLite file on a volume.
- **Cooklang:** borrow sections, `=` fixed quantities, servings scaling, aisle config. Do not adopt the file format.

## Conventions

Copy decisions from the incumbents by default; diverge only where this file says to. Both are AGPL-3.0 — this project is not distributed, so the licenses don't bind, but do not paste their source in.


Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Tests use vitest, run as `bun run test`. Never `bun test`. This overrides the generic Bun guidance.
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- HTTP is handled by TanStack Start's server (Nitro, Bun preset). Don't add `express` or a second server.
- `bun:sqlite` for SQLite, with Drizzle (`drizzle-orm/bun-sqlite`) as the query builder over it. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

vitest, always through the script: `bun run test`. Never call `bun test` directly; the two runners have different semantics and the gate must be one command everywhere.

```ts
import { test, expect } from "vitest";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

This project uses TanStack Start, not Bun HTML imports. Vite is run through Bun:

```json
{ "dev": "bun --bun vite dev", "build": "bun --bun vite build", "start": "bun run .output/server/index.mjs" }
```

`vite.config.ts` plugins: `tanstackStart({ spa: { enabled: true } })`, `nitro({ preset: "bun" })`, `viteReact()`, `tailwindcss()`. Routes live in their section's `routes/` (the root and the tree in `src/routes/`); server routes in a section's `routes/api/` or `src/api/rest/`. Server functions via `createServerFn`, validated with zod. `bun:sqlite` is still the store and is imported only from server code.

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

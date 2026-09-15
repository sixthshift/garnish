# garnish

A personal recipe manager. Single household, runs on the LAN, no public exposure.

## Docs

- [`docs/intent.md`](docs/intent.md) — why, and what it refuses to do
- [`docs/architecture.md`](docs/architecture.md) — stack, data model, scaling, API, persistence rules
- [`docs/decisions.md`](docs/decisions.md) — decision log; add a row to reverse one, don't edit
- [`docs/scope.md`](docs/scope.md) — v1, later, open, never
- [`docs/plan.md`](docs/plan.md) — implementation tasks and the per-task protocol. Run with `/ailoop`

Keep the argument in `docs/`; keep operating constraints here.

## Constraints

- **Store:** SQLite via `bun:sqlite` is the only store. No file export in v1. Recipes are mastered in the DB.
- **Queries:** Drizzle ORM over that same `bun:sqlite` handle (decisions.md row 46). `src/db/models/` is one folder per domain: `schema.ts` declares that domain's tables, `repo.ts` is its repository. No barrel — repositories import the tables they touch directly. Repositories use the query builder, not SQL strings. `migrations/*.sql` applied by `src/db/migrations/migrate.ts` still build the database — drizzle-kit only *generates* SQL to review (`bun run db:generate`), it never applies it.
- **Modules:** every folder under `src/domain/` is a module — recipe, ingredient, reference, shopping, plan, style, draft, import. Its `index.ts` is its only entry: it exports a chosen surface, not everything the folder has, and nothing outside the folder imports a deeper path (`test/modules.test.ts` enforces it). This is not a barrel, and the no-barrel rule for `src/db/models/` stands. Dependencies run one way (reference ← ingredient ← recipe ← shopping ← plan; draft and import sit on top; style alone); never make two modules import each other. `import`'s surface is an `Importer` object — `new Importer(ports).import(source)` — that chooses the sequence for a URL, a paste or a file, with the page fetch and the model as injected ports so the whole pipeline runs in a test with two fakes. The recipe editor's model is `src/domain/draft/`. `src/lib/` holds only truly generic utilities (id, lists, numbers, dates, urls, errors, search, swipe) and, in `lib/ui/`, the logic behind the generic primitives; a pure function that serves one component stays in that component. `src/domain/` may import a lib file only if it is a library, one that imports nothing of the app; `src/lib/` never imports routes or components.
- **Schema:** Mealie's shapes outside recipe internals, minus users and groups. `https://demo.mealie.io/openapi.json` is the reference.
- **Tie-breaker:** when unsure about any product or schema question, do what Mealie does.
- **Recipe internals:** a recipe is an ordered list of named parts; each owns its ingredients and its steps, and the unnamed part (`name = ''`) is the recipe's main body. Sub-recipes hang off `food.recipe_id`; the column exists, the behaviour is deferred.
- **Auth:** none. No users table, no sessions.
- **AI:** none in v1. Design the recipe document so a future import by a hosted model over an OpenAI-compatible endpoint returns exactly what the editor saves.
- **Framework:** TanStack Start (React 19, file routes under `src/routes/`). Routing is code, not file names: `src/routes/root.tsx` is the root route, every page is a plain folder under `src/routes/` holding `route.tsx` (its `createRoute`: search schema, loader, and the page via `lazyRouteComponent`), `page.tsx` (the page component, nothing else exported) and `components/` for the React components only it uses; `src/routes/routes.ts` lists the pages and builds the tree, and `src/routes/api/` holds the server routes (`createRoute` with `server.handlers`, added on the server only). A component shared by pages under one route sits in that route's `components/` (`recipes/components/` is the editor); `src/components/` keeps only what unrelated pages or the shell share. Start's generator still runs for its asset manifest (root only, output gitignored under `.tanstack/`); nothing imports it. No `createFileRoute`. Vite is its build tool, run via `bun --bun vite`. This overrides the generic Bun guidance below about HTML imports and avoiding Vite. Server functions for the app's own data calls; server routes only for `/api/*` endpoints that outside callers need (health, images, future import).
- **Rendering:** SPA mode (`spa.enabled`). No SEO need; the PWA shell caches cleanly.
- **Frontend:** React 19 + Tailwind 4 via `@tailwindcss/vite`. Phone-first PWA.
- **UI kit:** `@sixthshift/design-system` (Jason's personal system). Subpath imports only, e.g. `@sixthshift/design-system/button`. Check its exports before writing any UI element. Missing primitives are built locally from its pieces.
- **Locale:** metric, en-AU spelling. UUID ids, zod validation, images on disk.
- **Tests:** vitest via `bun run test`. Not `bun test`.
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

`vite.config.ts` plugins: `tanstackStart({ spa: { enabled: true } })`, `nitro({ preset: "bun" })`, `viteReact()`, `tailwindcss()`. Routes and server routes live in `src/routes/`. Server functions via `createServerFn`, validated with zod. `bun:sqlite` is still the store and is imported only from server code.

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

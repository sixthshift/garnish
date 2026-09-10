# Architecture

How garnish is built. Decisions and their alternatives are in [decisions.md](decisions.md); what ships when is in [scope.md](scope.md).

## Shape

- One Bun process. TanStack Start on Nitro's Bun preset serves the app, server functions and `/api/*` routes. The server entry (`src/server.ts`) creates `DATA_DIR`, opens, migrates and seeds the database before the first request, so a broken volume fails the start, not a user.
- One SQLite file. `bun:sqlite`, WAL mode, foreign keys on.
- One Docker container. The SQLite file lives on a mounted volume.
- LAN only. No auth, no users, no accounts.

```
browser (PWA) ──server fns / HTTP──▶ TanStack Start (Nitro, Bun) ──▶ bun:sqlite ──▶ garnish.db (volume)
```

## Layout

```
src/
  routes/       TanStack Start file routes: pages, and server routes under routes/api/
  server/       server functions (createServerFn) grouped by resource, image handlers, db handle, boot
  db/           migrations/*.sql, migrate.ts, seed.ts, sample.ts, backup.ts, repositories, errors
  domain/       zod schemas, scaling, formatting, cook-mode cards. Pure, no IO, importable by client
  components/   React components; ui/ holds local primitives the design system lacks
  lib/          client-side helpers: mutate, ids, image URLs, service worker registration, hooks
  sw/           service worker source (worker.ts, entry.ts) and the Vite plugin that emits it
  styles.css    Tailwind entry with the design system's theme and @source
  router.tsx    getRouter()
  server.ts     custom server entry: boot, then the default Start handler
vite.config.ts  tanstackStart({ spa }), nitro({ preset: 'bun' }), viteReact(), tailwindcss(), serviceWorkerPlugin()
public/         manifest.webmanifest, icons/, apple-touch-icon.png
test/           mirrors src/, plus docs/, docker/ and pwa/ contract tests
data/           runtime volume: garnish.db, images/, backups/  (gitignored)
```

Scripts in `package.json`: `dev`, `build`, `start`, `check`, `test`, `migrate`, `seed`, `backup`. README.md says how to use them.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun 1.4 or newer (1.3 cannot parse the built server, decisions.md row 32) |
| Framework | TanStack Start, SPA mode, file routes in `src/routes/` |
| Build | Vite via `bun --bun vite`, `NODE_ENV=production` set by the build script; Nitro Bun preset for production; the service worker is emitted by a small Vite plugin in the client build |
| Frontend | React 19 + Tailwind 4 via `@tailwindcss/vite` |
| UI kit | `@sixthshift/design-system`, subpath imports. Gaps built locally from its primitives under `src/components/ui/`: `Rating`, `NumberStepper`, `ReorderList`, `ImageUpload`, `Combobox`, `ConfirmDialog` |
| Storage | SQLite (`bun:sqlite`) |
| Validation | zod, one schema per document, shared by API and editor |
| IDs | UUID, plus slug on recipe (Mealie) |
| Tests | vitest, run as `bun run test` (`bun --bun vitest run`, so `bun:sqlite` resolves). The nitro plugin is left out of the config under vitest |
| Deploy | Docker, single container, one volume |

## Data model

Mealie's schema outside recipe internals, minus users and groups. Tandoor's shape inside recipes. When a field is in doubt, Mealie wins.

```
recipe        id, slug, name, description, image, rating, last_made,
              servings, yield_quantity, yield_unit_id?, yield_text,
              prep_minutes, cook_minutes, source_url, created_at, updated_at
recipe_note   id, recipe_id, position, title, text
component     id, recipe_id, position, name
ingredient    id, component_id, position, quantity?, unit_id?, food_id?,
              note, original_text, fixed
step          id, recipe_id, component_id?, position, text
food          id, name, plural_name, aliases, aisle_id?, recipe_id?, skip_shopping
aisle         id, name, position
unit          id, name, plural_name, abbreviation, use_abbreviation, fraction,
              standard_quantity?, standard_unit_id?
tag           id, name, slug
recipe_tag    recipe_id, tag_id
migration     id, name, applied_at
```

Ids are UUID text; timestamps are ISO 8601 UTC text. `food`, `unit`, `aisle` and `tag` names are unique case-insensitively. Deleting a recipe cascades to its components, ingredients, steps, notes and tag links; deleting a food, unit or aisle sets the references null. `position` is unique within its parent.

The document the API reads and writes (`src/domain/recipe.ts`) mirrors these columns in camelCase, with Mealie's names where Mealie has the concept: `servings` → `recipeServings`, `yield_quantity` → `recipeYieldQuantity`, `yield_text` → `recipeYield`, `prep_minutes` → `prepTime`, `cook_minutes` → `performTime`. The two times are integer minutes, not Mealie's free-text strings (decisions.md row 35). Array order carries `position`, so the document has no position fields. Foreign keys come back as nested objects (`unit`, `food`, `yieldUnit`, `tags`); writes use only the nested `id`. Steps with a `component_id` nest under that component's `steps`; the rest are the recipe-level `steps` array.

- A recipe is an ordered list of components. Every recipe has at least one; a single unnamed component is the flat case.
- Each component owns its ingredients. Same food in two components is two rows.
- Steps belong to the recipe and may point at a component. A component can hold several steps.
- `quantity` null means "no amount" (salt to taste). `fixed` true means "has an amount, does not scale" (one egg wash). Cooklang's `=`.
- `food_id` and `unit_id` are nullable. A line that is only text still saves. `original_text` is always kept.
- Servings and yield: `servings` and `yield_quantity` are numbers and scale; `yield_text` is display. Mealie's three fields. `yield_unit_id` lets a parent later ask for "150 ml of this".
- Sub-recipes attach to the **food**, not the ingredient row: `food.recipe_id`. An ingredient line reads "150 g hollandaise" and does not care whether hollandaise has a recipe. Tandoor's shape. Scaling through it is deferred, see [scope.md](scope.md).
- `food.skip_shopping` for water, salt, pepper. `aisle` is its own table. `unit.standard_*` is the hook for conversions later.
- Quantities are stored as decimals. `unit.fraction` says whether to render ½ or 0.5.
- Images live on the disk volume as `DATA_DIR/images/<recipeId>.<ext>`, one per recipe; `recipe.image` holds only the file name. Not in the DB.

## Scaling

- `factor = target_servings / recipe.servings`
- Linear ingredients multiply by `factor`, and so does `recipeYieldQuantity`. Fixed and null quantities do not.
- Timers and cookware never scale.
- Scaling is computed on read (`getRecipe` with `servings`). Nothing scaled is persisted. A recipe stored with 0 servings has no factor and is returned as stored.

## Shopping list

Design only. Not built in v1; see "Later" in [scope.md](scope.md). The schema hooks (`aisle`, `food.skip_shopping`, `unit.standard_*`) exist so it slots in without a migration of the recipe tables.

- Aggregates ingredients across selected recipes.
- Merges by `(food, unit)` into one line. Each line expands to its sources: recipe, component, quantity. Mealie's `recipeReferences` per item.
- Until unit conversions exist, 1 cup flour and 300 g flour are two lines. Known and accepted.
- Grouped by `aisle`. Foods with `skip_shopping` are omitted.

## API

- **Server functions** (`createServerFn`) for everything the app itself calls, one file per resource in `src/server/`. Input validated with the shared zod schemas. Reads use `method: 'GET'` so they are cacheable; writes are `POST`.
  - `recipes`: `listRecipes({ q?, tag? })` (card summaries, newest first), `getRecipe({ slug, servings? })`, `createRecipe(doc)`, `updateRecipe({ id, doc })`, `deleteRecipe({ id })`.
  - `foods`, `units`, `aisles`, `tags`: `list({ q? })`, `create`, `update`, `delete`, `findOrCreate({ name })` each, e.g. `listUnits`, `findOrCreateTag`. Input schemas in `src/domain/reference.ts`.
  - Every chain carries `notFoundMiddleware` (`src/server/fn.ts`), which rethrows a repository `NotFound` as the router's `notFound()`; loaders render it through `notFoundComponent`. It is a middleware rather than a wrapper around `createServerFn` because Start's compiler must see the literal chain (decisions.md row 36).
  - Deletes return the removed row, as Mealie does.
- **Server routes** under `/api/*` only for callers outside the app, and later import hooks. Field names follow Mealie where the concept exists.
  - `GET /api/health` → `{ "ok": true }`. The Docker healthcheck probes it.
  - `POST /api/recipes/:id/image`: multipart, file in the `image` field, png/jpeg/webp/gif sniffed from the bytes, 20 MB cap. Replaces the recipe's file and answers `{ image: "<id>.<ext>" }`.
  - `GET /api/images/:file`: the stored bytes. Names that are not `<uuid>.<ext>` are rejected before touching the filesystem.
- Recipe read returns the full nested document: recipe, components, ingredients, steps, notes, tags.
- Recipe write accepts the same document. One transaction, whole recipe replaced, `id` and `created_at` kept. Slug derived from the name, de-duplicated with a suffix.
- Route loaders are the only read path and call server functions directly; there is no client cache and TanStack Query is not added. Mutations go through `src/lib/mutate.ts`: call the server function, then `router.invalidate()` so every active loader re-runs.

## Frontend

- Routes: `/` (list with `q` and `tag` search params), `/recipes/new`, `/recipes/$slug` (`?servings=`), `/recipes/$slug/edit`, `/recipes/$slug/cook` (`?servings=&step=`), `/settings`. Search params are zod-validated and feed the loader, so the URL is the state.
- Shell: bottom nav on phones, side nav from `md` up. Cook mode opts out with `staticData.fullscreen`. Router-wide pending, error and not-found views (`src/components/RouteStates.tsx`) built from design system pieces; a design system `ErrorBoundary` around the shell is the last line of defence; every list sits in an `EmptyBoundary`. A failed fetch is shown as "can't reach the server" with Retry, or "you are offline" when the browser knows.
- Cook view: the recipe as a deck of cards (`src/domain/cook.ts`): per component, one ingredients card then one card per step, then the recipe-level steps. One card at a time, large type, scale control always visible, arrow keys move. Screen wake lock held while mounted (`src/lib/useWakeLock.ts`), silent where unsupported.
- Editor: components are the primary unit. Each has an ingredient list and a step list. Add, rename, reorder, move ingredients between them. Unit and food autocomplete with find-or-create; a text-only ingredient row saves as Mealie's disable-amount case. Reorder is up/down buttons, no drag.
- Theme follows the system via the design system's `bootstrapTheme` and `data-theme`; an inline script sets the attribute before first paint. Fonts: Inter and JetBrains Mono, self-hosted via fontsource.

## PWA

- Installable: `public/manifest.webmanifest`, SVG and PNG icons drawn from the brand tokens, Apple metas in the root route.
- Service worker: hand-written (`src/sw/worker.ts`), no workbox. `src/sw/plugin.ts` bundles it with `Bun.build` and emits `sw.js` as an asset of the client build, because Nitro serves static files from a manifest baked at build time and a file dropped in afterwards is a 404 (decisions.md row 37). Registered in production only (`src/lib/sw.ts`); dev has no `/sw.js`.
- Policies: navigations go to the network and fall back to the cached shell; built assets and `public/` are cache-first (precached at install); `GET /_serverFn/*` and `/api/images/*` are network-first and stored on success, so a recipe read while online opens offline. Two caches: a versioned precache replaced on every deploy, and one data cache that survives deploys.
- Writes are never attempted offline. `useOnline` shows a notice in the editor and disables Save.

## Persistence rules

- `DATA_DIR` (default `./data`) holds `garnish.db`, `images/` and `backups/`. It is created on boot if missing.
- Migrations are numbered SQL files in `src/db/migrations/` applied in order, each in its own transaction with its `migration` row. They run at boot and via `bun run migrate`. The built server has no source tree, so `src/server/db.ts` inlines them with `import.meta.glob` (decisions.md row 38); the CLI reads the directory.
- One process-wide handle (`getDb()`), opened lazily, migrated and seeded once, retried on failure.
- Backup is a copy of the database file, taken via `VACUUM INTO` so it is consistent: `bun run backup` writes `DATA_DIR/backups/garnish-YYYYMMDD-HHmmss.db` (UTC). Restore is a file copy with the WAL sidecars removed; README.md has the steps.
- No file export in v1. The database is the only store.
- Seed: fifteen metric and common imperial units, matched by name case-insensitively so re-seeding never overwrites edits. Runs at boot and via `bun run seed`. `bun run seed --sample` adds three demo recipes (one with three components), idempotent by slug. Foods and aisles start empty.
- Locale: metric, en-AU spelling. Imperial units available, never default.

## Deploy

- Two-stage `Dockerfile` on `oven/bun:1.4.2` (install and `bun run build`) then `oven/bun:1.4.2-slim` with only `.output/`. `bun:sqlite` is built into Bun, so nothing else is installed at runtime.
- `DATA_DIR=/data` is the volume; `PORT=3000`, `HOST=0.0.0.0`. Runs as root, like Mealie's default, so a bind-mounted host directory needs no ownership setup.
- `HEALTHCHECK` fetches `/api/health` with Bun itself (the slim image has no curl).
- `docker-compose.yml`: one service `garnish`, port 3000 published, named volume `garnish-data` at `/data`, `restart: unless-stopped`.

## Non-goals

Inventory, nutrition, costing, native app, multi-tenancy, public exposure. See [intent.md](intent.md).

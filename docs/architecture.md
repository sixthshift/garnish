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
  server/       server functions (createServerFn) grouped by resource, image upload/serve/fetch handlers, db handle, boot
  db/           migrations/*.sql, migrate.ts, seed.ts, sample.ts, backup.ts, repositories (incl. timeline.ts), errors
  domain/       zod schemas, scaling, formatting, cook-mode cards, ingredient merge, markdown, sort and filter helpers, bulk-add text cleanup. Pure, no IO, importable by client
  components/   React components; ui/ holds local primitives the design system lacks
  lib/          client-side helpers: mutate, ids, image URLs, clipboard, service worker registration, hooks, and the client stores (prefs, ticks, notices)
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
| UI kit | `@sixthshift/design-system`, subpath imports (`sheet`, `toast`, `popover`, `tabs`, `search-input`, `switch`, `badge`, `tooltip`, `modal`). Gaps built locally from its primitives under `src/components/ui/`: `Rating`, `NumberStepper`, `ReorderList`, `ImageUpload`, `Combobox`, `ConfirmDialog`, `UsageConfirmDialog`, `Menu`, `DataTable`, `EditSheet`, `BulkAddSheet`, `SaveBar` |
| Storage | SQLite (`bun:sqlite`) |
| Validation | zod, one schema per document, shared by API and editor |
| IDs | UUID, plus slug on recipe (Mealie) |
| Tests | vitest, run as `bun run test` (`bun --bun vitest run`, so `bun:sqlite` resolves). The nitro plugin is left out of the config under vitest |
| Deploy | Docker, single container, one volume |

## Data model

Mealie's schema outside recipe internals, minus users and groups. Tandoor's shape inside recipes. When a field is in doubt, Mealie wins.

```
recipe        id, slug, name, description, image, rating, last_made, favourite,
              servings, yield_quantity, yield_unit_id?, yield_text,
              prep_minutes, cook_minutes, source_url, created_at, updated_at
recipe_note   id, recipe_id, position, title, text
timeline_event id, recipe_id, occurred_on, message, image, created_at
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

Ids are UUID text; timestamps are ISO 8601 UTC text. `food`, `unit`, `aisle` and `tag` names are unique case-insensitively. Deleting a recipe cascades to its components, ingredients, steps, notes, timeline events and tag links; deleting a food, unit or aisle sets the references null. `position` is unique within its parent.

Migrations so far: `001_init.sql` is the schema above; `002_stage2.sql` adds `recipe.favourite` and `timeline_event` (decisions.md rows 41 and 43).

The document the API reads and writes (`src/domain/recipe.ts`) mirrors these columns in camelCase, with Mealie's names where Mealie has the concept: `servings` → `recipeServings`, `yield_quantity` → `recipeYieldQuantity`, `yield_text` → `recipeYield`, `prep_minutes` → `prepTime`, `cook_minutes` → `performTime`. The two times are integer minutes, not Mealie's free-text strings (decisions.md row 35). Array order carries `position`, so the document has no position fields. Foreign keys come back as nested objects (`unit`, `food`, `yieldUnit`, `tags`); writes use only the nested `id`. Steps with a `component_id` nest under that component's `steps`; the rest are the recipe-level `steps` array.

- A recipe is an ordered list of components. Every recipe has at least one; a single unnamed component is the flat case.
- Each component owns its ingredients. Same food in two components is two rows.
- Steps belong to the recipe and may point at a component. A component can hold several steps.
- `quantity` null means "no amount" (salt to taste). `fixed` true means "has an amount, does not scale" (one egg wash). Cooklang's `=`.
- `food_id` and `unit_id` are nullable. A line that is only text still saves. `original_text` is always kept.
- Servings and yield: `servings` and `yield_quantity` are numbers and scale; `yield_text` is display. Mealie's three fields. `yield_unit_id` lets a parent later ask for "150 ml of this".
- Sub-recipes attach to the **food**, not the ingredient row: `food.recipe_id`. An ingredient line reads "150 g hollandaise" and does not care whether hollandaise has a recipe. Tandoor's shape. Scaling through it is deferred, see [scope.md](scope.md).
- `favourite` is a 0/1 flag on the recipe, not a magic tag (decisions.md row 43). Tags are the only organiser; there are no categories or tools (row 42).
- `timeline_event` is one logged cook: `occurred_on` is a calendar date (`YYYY-MM-DD`), `message` a comment, `image` an optional photo file name. `recipe.last_made` is derived, never written directly: creating or deleting an event recomputes it as the greatest `occurred_on`, falling back to null. Mealie's "Made this" shape (decisions.md row 41).
- `food.skip_shopping` for water, salt, pepper. `aisle` is its own table. `unit.standard_*` is the hook for conversions later.
- Quantities are stored as decimals. `unit.fraction` says whether to render ½ or 0.5.
- Images live on the disk volume: `DATA_DIR/images/<recipeId>.<ext>`, one per recipe, and `DATA_DIR/images/timeline/<eventId>.<ext>`, one per logged cook. `recipe.image` and `timeline_event.image` hold only the file name. Not in the DB.

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
  - `recipes`: `listRecipes({ q?, tag?, tags?, match?, foods?, favourite?, sort?, dir?, seed? })` (card summaries), `getRecipe({ slug, servings? })`, `createRecipe(doc)`, `updateRecipe({ id, doc })`, `duplicateRecipe({ id })`, `setFavourite({ id, favourite })`, `deleteRecipe({ id })`.
    - Filters combine with AND: name substring, tag slugs (`match: 'any' | 'all'`, default any; the older singular `tag` folds in), food ids, favourites-only.
    - `sort` is `name | created | updated | lastMade | rating | random`, with `dir` defaulting per key and nulls last. `random` takes a `seed` so the same URL keeps the same order. Unsorted is newest first.
    - Summaries carry what the card draws: name, slug, image, rating, tags, `favourite`, `lastMade` and `totalTime`.
  - `timeline`: `listTimeline({ recipeId })` (newest first), `createTimelineEvent({ recipeId, event })`, `deleteTimelineEvent({ id })`. Both writes recompute `recipe.last_made`.
  - `foods`, `units`, `aisles`, `tags`: `list({ q? })`, `create`, `update`, `delete`, `findOrCreate({ name })` each, e.g. `listUnits`, `findOrCreateTag`. Input schemas in `src/domain/reference.ts`.
    - `usingFood`, `usingUnit`, `usingTag` list the recipes a delete would touch; the confirm dialog shows them.
    - `mergeFood`, `mergeUnit`, `mergeTag` repoint references onto a target and delete the source in one transaction. `reorderAisles` writes a new `position` order.
  - `fetchImage({ url })` pulls a pasted image URL server-side through the same sniffing and cap as the upload route, so the editor never fetches cross-origin from the browser.
  - Every chain carries `notFoundMiddleware` (`src/server/fn.ts`), which rethrows a repository `NotFound` as the router's `notFound()`; loaders render it through `notFoundComponent`. It is a middleware rather than a wrapper around `createServerFn` because Start's compiler must see the literal chain (decisions.md row 36).
  - Deletes return the removed row, as Mealie does.
- **Server routes** under `/api/*` only for callers outside the app, and later import hooks. Field names follow Mealie where the concept exists.
  - `GET /api/health` → `{ "ok": true }`. The Docker healthcheck probes it.
  - `POST /api/recipes/:id/image`: multipart, file in the `image` field, png/jpeg/webp/gif sniffed from the bytes, 20 MB cap. Replaces the recipe's file and answers `{ image: "<id>.<ext>" }`.
  - `GET /api/images/:file`: the stored bytes. Names that are not `<uuid>.<ext>` are rejected before touching the filesystem.
  - `POST /api/timeline/:id/image` and `GET /api/images/timeline/:file`: the same pair for a logged cook's photo, under `images/timeline/`.
- Recipe read returns the full nested document: recipe, components, ingredients, steps, notes, tags. `favourite` is part of it; timeline events are read separately.
- Recipe write accepts the same document. One transaction, whole recipe replaced, `id` and `created_at` kept. Slug derived from the name, de-duplicated with a suffix.
- Route loaders are the only read path and call server functions directly; there is no client cache and TanStack Query is not added. Mutations go through `src/lib/mutate.ts`: call the server function, then `router.invalidate()` so every active loader re-runs.

## Frontend

- Routes: `/` (list; `q`, `tag`/`tags`, `match`, `foods`, `favourite`, `sort`, `dir`, `seed` search params), `/recipes/new`, `/recipes/$slug` (`?servings=`), `/recipes/$slug/edit`, `/recipes/$slug/cook` (`?servings=&step=`), `/settings`. Search params are zod-validated and feed the loader, so the URL is the state.
- Shell: bottom nav on phones, side nav from `md` up. Cook mode opts out with `staticData.fullscreen`. Router-wide pending, error and not-found views (`src/components/RouteStates.tsx`) built from design system pieces; a design system `ErrorBoundary` around the shell is the last line of defence; every list sits in an `EmptyBoundary`. A failed fetch is shown as "can't reach the server" with Retry, or "you are offline" when the browser knows. One design system `Toaster` is mounted in `__root.tsx`; saves, deletes and upload failures report through `notify()` (`src/lib/notify.ts`) rather than inline copy.
- Client stores, all guarded with try/catch so a blocked or full storage degrades to defaults:
  - `src/lib/prefs.ts` — localStorage, per device: list view mode, sort, structured/summary ingredients, theme, screen-awake.
  - `src/lib/ticks.ts` — sessionStorage, keyed by recipe id: which ingredients and steps are ticked. Shared by the view page and cook mode.
- List: cards carry image, name, rating stars, total-time chip, up to three tags with `+N`, and a favourite heart that writes through `setFavourite` optimistically. Grid and list modes, scroll position restored on back. Filter bar (tag chips with an any/all switch, food `Combobox`, favourites toggle), sort menu and a dice button that opens one random recipe. `/` outside an input opens a global search dialog over `listRecipes` with arrow-key selection and Enter to open.
- Recipe view: header with the image beside the text from `md` and stacked below, name, rating, description, tags, a prep/cook/total stat strip and a yield line; footer carries the source link and the created and updated dates. Ingredient rows follow Mealie (quantity, unit, **bold** food, dimmed note, `fixed` marker) with a tick box each, and a Structured/Summary switch between per-component blocks and one merged list (`mergeIngredients` in `src/domain/merge.ts`). Steps tick to dim and collapse; step text renders through a safe markdown subset (`src/domain/markdown.ts`: paragraphs, bold, italics, lists, no raw HTML). A "Serves N" chip with − / + and a number popover scales, as does "Scale to…" on an ingredient row (`servingsForTarget`). A `Menu` holds Edit, Cook, Duplicate, Copy link, Copy ingredients, Print and Delete; Print is a `@media print` block in `styles.css`, not a second route.
- Made this: a `sheet` beside last-made takes a date, a comment and an optional photo; the timeline sits under Notes, newest first, each event deletable. It is also the cook mode finish card's shortcut.
- Cook view: the recipe as a deck of cards (`src/domain/cook.ts`): per component, one ingredients card then one card per step, then the recipe-level steps. One card at a time, large type, scale control always visible. Component pills jump between components, arrow keys and vertical swipe (`swipeIntent` separates a swipe from a scroll) move, and an ARIA live region announces the card. Ingredient items tick through the shared store. The last card is "Finished", with Made this and Exit. Screen wake lock held while mounted (`src/lib/useWakeLock.ts`), silent where unsupported.
- Editor: components are the primary unit. Each has an ingredient list and a step list. Add, rename, reorder, move ingredients between them. Unit and food autocomplete with find-or-create; a text-only ingredient row saves as Mealie's disable-amount case. Below `md` an ingredient row collapses to one summary line with a chevron that opens a `sheet` over the same fields; from `md` up the inline row stays and shows `originalText` in grey above a parsed row. `ReorderList` drags by a handle (pointer events, 250 ms touch delay) within a list and between components, with the up/down buttons and "Move to" kept. Bulk add pastes a block into text-only rows or steps with trim, number-strip and paragraph-split buttons; steps also insert above/below, split and merge. The image field accepts a pasted URL via `fetchImage`. An "Edit as JSON" toggle swaps the form for the document, applied through `recipeInputSchema`. A sticky save bar on phone (inline from `md`) plus dirty tracking, a `useBlocker` confirm on route leave and a `beforeunload` prompt.
- Settings: design system `tabs` — Foods, Units, Aisles, Tags, Appearance — over one local `DataTable` (search, sortable columns, edit `sheet` from a field spec, delete confirm listing the affected recipes). Foods and Units also merge into a target; Aisles reorder by drag; Tags group A–Z and click through to the filtered list. Appearance holds the light / dark / system theme toggle.
- Theme follows the pref, falling back to the system, via the design system's `bootstrapTheme` and `data-theme`; an inline script sets the attribute before first paint. Fonts: Inter and JetBrains Mono, self-hosted via fontsource.

## PWA

- Installable: `public/manifest.webmanifest`, SVG and PNG icons drawn from the brand tokens, Apple metas in the root route.
- Service worker: hand-written (`src/sw/worker.ts`), no workbox. `src/sw/plugin.ts` bundles it with `Bun.build` and emits `sw.js` as an asset of the client build, because Nitro serves static files from a manifest baked at build time and a file dropped in afterwards is a 404 (decisions.md row 37). Registered in production only (`src/lib/sw.ts`); dev has no `/sw.js`.
- Policies: navigations go to the network and fall back to the cached shell; built assets and `public/` are cache-first (precached at install); `GET /_serverFn/*` and `/api/images/*` are network-first and stored on success, so a recipe read while online opens offline. Two caches: a versioned precache replaced on every deploy, and one data cache that survives deploys.
- Writes are never attempted offline. `useOnline` shows a notice in the editor and disables Save.

## Persistence rules

- `DATA_DIR` (default `./data`) holds `garnish.db`, `images/` (with `images/timeline/`) and `backups/`. It is created on boot if missing.
- Migrations are numbered SQL files in `src/db/migrations/` applied in order, each in its own transaction with its `migration` row. They run at boot and via `bun run migrate`. The built server has no source tree, so `src/server/db.ts` inlines them with `import.meta.glob` (decisions.md row 38); the CLI reads the directory.
- One process-wide handle (`getDb()`), opened lazily, migrated and seeded once, retried on failure.
- Backup is a copy of the database file, taken via `VACUUM INTO` so it is consistent: `bun run backup` writes `DATA_DIR/backups/garnish-YYYYMMDD-HHmmss.db` (UTC). Restore is a file copy with the WAL sidecars removed; README.md has the steps.
- No file export in v1. The database is the only store.
- Seed: fifteen metric and common imperial units, matched by name case-insensitively so re-seeding never overwrites edits. Runs at boot and via `bun run seed`. `bun run seed --sample` adds three demo recipes (one with three components), idempotent by slug: one is favourited, one carries a source URL and one has two timeline events, so every stage 2 screen has data. Foods and aisles start empty.
- Locale: metric, en-AU spelling. Imperial units available, never default.

## Deploy

- Two-stage `Dockerfile` on `oven/bun:1.4.2` (install and `bun run build`) then `oven/bun:1.4.2-slim` with only `.output/`. `bun:sqlite` is built into Bun, so nothing else is installed at runtime.
- `DATA_DIR=/data` is the volume; `PORT=3000`, `HOST=0.0.0.0`. Runs as root, like Mealie's default, so a bind-mounted host directory needs no ownership setup.
- `HEALTHCHECK` fetches `/api/health` with Bun itself (the slim image has no curl).
- `docker-compose.yml`: one service `garnish`, port 3000 published, named volume `garnish-data` at `/data`, `restart: unless-stopped`.

## Non-goals

Inventory, nutrition, costing, native app, multi-tenancy, public exposure. See [intent.md](intent.md).

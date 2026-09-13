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
  server/       server functions (createServerFn) grouped by resource, image upload/serve/fetch handlers, db handle, boot, errors.ts (NotFound, mapped to TanStack's notFound())
  db/connection/ open.ts (DB_FILE, databasePath, openDatabase — WAL and foreign keys), client.ts (the Drizzle handle)
  db/seed/      seed.ts inserts; units.ts, recipes.ts and timeline.ts are the data it inserts; cli.ts is `bun run seed [--sample]`
  db/dev/       dev-only, never shipped: generate.ts builds a fifty-recipe dataset from vocabulary.ts with the seeded PRNG in random.ts and placeholder images from png.ts; apply.ts writes it; wipe.ts empties DATA_DIR first; cli.ts is `bun run dev:seed`
  db/backup/    backup.ts is the VACUUM INTO copy, cli.ts is `bun run backup`
  db/models/    one folder per domain, each with schema.ts (its Drizzle tables) and repo.ts (its repository); columns.ts holds the shared column defaults and the conventions they all follow
  db/models/recipe/    schema.ts: recipe, part, ingredient, step, recipe_note, recipe_tag — one aggregate, written as one document. repo.ts: the recipe repository
  db/models/food/      schema.ts, repo.ts
  db/models/unit/      schema.ts, repo.ts
  db/models/aisle/     schema.ts, repo.ts
  db/models/tag/       schema.ts, repo.ts
  db/models/timeline/  schema.ts, repo.ts — the "made this" log
  db/models/migration/ schema.ts only: the applied-migrations table, written by migrate.ts rather than a repository
  db/migrations/ 001_init.sql, 002_stage2.sql, 003_parts.sql — what actually builds the database — and migrate.ts, the runner that applies them
  domain/       zod schemas, scaling, formatting, cook-mode cards, ingredient merge, markdown, sort and filter helpers, bulk-add text cleanup, name and slug helpers (names.ts). Pure, no IO, importable by client
  components/   React components; ui/ holds local primitives the design system lacks
  lib/          client-side helpers: mutate, ids, image URLs, clipboard, service worker registration, hooks, and the client stores (prefs, ticks, notices)
  sw/           service worker source (worker.ts, entry.ts) and the Vite plugin that emits it
  styles/       theme.css: the Garnish theme, re-pointing the design system's semantic tokens
  styles.css    Tailwind entry: the design system's theme, @source, the Garnish theme, print rules
  router.tsx    getRouter()
  server.ts     custom server entry: boot, then the default Start handler
vite.config.ts  tanstackStart({ spa }), nitro({ preset: 'bun' }), viteReact(), tailwindcss(), serviceWorkerPlugin()
public/         manifest.webmanifest, icons/, apple-touch-icon.png
test/           mirrors src/, plus docs/, docker/ and pwa/ contract tests
data/           runtime volume: garnish.db, images/, backups/  (gitignored)
```

Scripts in `package.json`: `dev`, `dev:keep`, `build`, `start`, `check`, `test`, `migrate`, `seed`, `dev:seed`, `db:generate`, `backup`, `icons`. README.md says how to use them.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun 1.4 or newer (1.3 cannot parse the built server, decisions.md row 32) |
| Framework | TanStack Start, SPA mode, file routes in `src/routes/` |
| Build | Vite via `bun --bun vite`, `NODE_ENV=production` set by the build script; Nitro Bun preset for production; the service worker is emitted by a small Vite plugin in the client build |
| Frontend | React 19 + Tailwind 4 via `@tailwindcss/vite` |
| UI kit | `@sixthshift/design-system`, subpath imports (`sheet`, `toast`, `popover`, `tabs`, `search-input`, `switch`, `badge`, `tooltip`, `modal`). Gaps built locally from its primitives under `src/components/ui/`: `Rating`, `NumberStepper`, `ReorderList`, `ImageUpload`, `Combobox`, `ConfirmDialog`, `UsageConfirmDialog`, `Menu`, `DataTable`, `EditSheet`, `BulkAddSheet`, `SaveBar`, `Disclosure`, `EditorToolbar` |
| Storage | SQLite (`bun:sqlite`) |
| Queries | Drizzle ORM over that same `bun:sqlite` handle; tables in `src/db/models/<domain>/schema.ts` (decisions.md row 46) |
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
part          id, recipe_id, position, name
ingredient    id, part_id, position, quantity?, unit_id?, food_id?,
              note, original_text, fixed
step          id, part_id, position, text
step_ingredient step_id, ingredient_id, position
food          id, name, plural_name, aliases, aisle_id?, recipe_id?, skip_shopping
food_conversion id, food_id, unit_id, quantity, to_unit_id, to_quantity
aisle         id, name, position
unit          id, name, plural_name, abbreviation, use_abbreviation, fraction,
              standard_quantity?, standard_unit_id?
tag           id, name, slug
recipe_tag    recipe_id, tag_id
shopping_item id, position, food_id?, unit_id?, quantity?, text, ticked,
              created_at, updated_at
shopping_item_source id, item_id, recipe_id?, recipe_name, part_name,
              servings?, quantity?
meal_plan_entry id, date, position, recipe_id?, text, servings?
migration     id, name, applied_at
```

Ids are UUID text; timestamps are ISO 8601 UTC text. `food`, `unit`, `aisle` and `tag` names are unique case-insensitively. Deleting a recipe cascades to its parts, ingredients, steps, notes, timeline events and tag links; deleting a part cascades to its ingredients and steps; a step link cascades from either side, so deleting a step or an ingredient takes the links naming it; deleting a food, unit or aisle sets the references null. `position` is unique within its parent.

Migrations so far: `001_init.sql` is the first schema; `002_stage2.sql` adds `recipe.favourite` and `timeline_event` (decisions.md rows 41 and 43); `003_parts.sql` renames `component` to `part` and moves every step onto one, dropping `step.recipe_id` and rescoping `step.position` (decisions.md rows 48 and 49); `004_step_links.sql` adds `step_ingredient` (decisions.md row 64); `005_shopping.sql` adds `shopping_item` and `shopping_item_source` (decisions.md row 67); `006_conversions.sql` adds `food_conversion` (decisions.md row 69); `007_plan.sql` adds `meal_plan_entry` (decisions.md row 71).

The document the API reads and writes (`src/domain/recipe.ts`) mirrors these columns in camelCase, with Mealie's names where Mealie has the concept: `servings` → `recipeServings`, `yield_quantity` → `recipeYieldQuantity`, `yield_text` → `recipeYield`, `prep_minutes` → `prepTime`, `cook_minutes` → `performTime`. The two times are integer minutes, not Mealie's free-text strings (decisions.md row 35). Array order carries `position`, so the document has no position fields. Foreign keys come back as nested objects (`unit`, `food`, `yieldUnit`, `tags`); writes use only the nested `id`. Steps exist only inside `parts`; the document has no recipe-level `steps` array. A step carries `ingredientIds`: the ids of the ingredients it uses, in link order.

- A recipe is an ordered list of parts. Every recipe has at least one; a single unnamed part is the flat case.
- Each part owns its ingredients and its steps. Same food in two parts is two rows.
- Steps link ingredients, many to many, **within one part** (decisions.md row 64). Ownership is the tree; a link is only "this step uses that row". A step may link any ingredient of its own part, and an ingredient may be linked from several of that part's steps. A link across parts is dropped on save rather than failing it — the row belongs in this part, or in the recipe's body. A link carries the whole row: splitting one amount across steps is two rows, not two links.
- The unnamed part (`name = ''`) is the recipe's main body, printed without a heading — so a recipe with one named sub-preparation does not have to invent a heading like "To assemble" for the rest of its method.
- `quantity` null means "no amount" (salt to taste). `fixed` true means "has an amount, does not scale" (one egg wash). Cooklang's `=`.
- `food_id` and `unit_id` are nullable. A line that is only text still saves. `original_text` is always kept.
- Servings and yield: `servings` and `yield_quantity` are numbers and scale; `yield_text` is display. Mealie's three fields. `yield_unit_id` lets a parent later ask for "150 ml of this".
- Sub-recipes attach to the **food**, not the ingredient row: `food.recipe_id`. An ingredient line reads "150 g hollandaise" and does not care whether hollandaise has a recipe. Tandoor's shape. Scaling through it is deferred, see [scope.md](scope.md).
- `favourite` is a 0/1 flag on the recipe, not a magic tag (decisions.md row 43). Tags are the only organiser; there are no categories or tools (row 42).
- `timeline_event` is one logged cook: `occurred_on` is a calendar date (`YYYY-MM-DD`), `message` a comment, `image` an optional photo file name. `recipe.last_made` is derived, never written directly: creating or deleting an event recomputes it as the greatest `occurred_on`, falling back to null. Mealie's "Made this" shape (decisions.md row 41).
- `food.skip_shopping` for water, salt, pepper. `aisle` is its own table.
- Conversions are per food (decisions.md row 69): `food_conversion` reads "1 cup of plain flour is 125 g", one row per food per pair of units, both units cascading, and the food document carries them as `conversions`. `unit.standard_quantity` / `unit.standard_unit_id` keep the unit-to-unit conversions that hold whatever is being measured (1 l is 1000 ml). A cup of flour is 125 g and a cup of sugar is 220 g, so the food's rows are tried first and the unit's are the fallback.
- Quantities are stored as decimals. `unit.fraction` says whether to render ½ or 0.5.
- Images live on the disk volume: `DATA_DIR/images/<recipeId>.<ext>`, one per recipe, and `DATA_DIR/images/timeline/<eventId>.<ext>`, one per logged cook. `recipe.image` and `timeline_event.image` hold only the file name. Not in the DB.

## Scaling

- `factor = target_servings / recipe.servings`
- Linear ingredients multiply by `factor`, and so does `recipeYieldQuantity`. Fixed and null quantities do not.
- Timers and cookware never scale.
- Nothing scaled is ever persisted. A recipe stored with 0 servings has no factor and is returned as stored.
- Where it happens (decisions.md row 62): **on the client**. The recipe and cook loaders fetch the stored document once — `?servings=` is not a loader dep — and each page applies `scaledForServings(doc, servings)` from the search param, so − and + repaint without a request while the URL still carries the scale.
- `getRecipe({ slug, servings })` scales the same way on the server, for outside callers and for a URL opened cold. Both sides call the one pure function in `src/domain/scale.ts`, so they cannot drift.

## Shopping list

One list for the household, with no owner and no list table (decisions.md row 67): Mealie has many lists because it has many users and groups, and garnish has neither. `005_shopping.sql` builds it; the document is `src/domain/shopping.ts`, the repository `src/db/models/shopping/repo.ts`, the server functions `src/server/shopping.ts`.

- A line is a food line (`food_id`, with an optional `unit_id` and `quantity`) or a free-text line (`text`, "batteries"). One table holds both, as Mealie's `shopping_list_item` does.
- `position` is the list order over the whole list. It is not unique: a reorder rewrites every row in one transaction.
- `ticked` is the supermarket's only write, and the one write the app queues offline (M31.5). `updated_at` moves with every change.
- `shopping_item_source` is where a line came from — Mealie's `recipeReferences`, one row per contributing recipe: `recipe_id` while the recipe exists, plus `recipe_name`, `part_name`, `servings` and the `quantity` that source contributed. The names are copies, not joins, so an expanded line still reads "Lemon tart, Pastry, serves 4" after the recipe is renamed or deleted; `recipe_id` goes null with the recipe, the sources cascade with their line.
- The document nests `food` (carrying its aisle) and `unit` as the recipe document does, and nests `sources` under their line. Writes send ids only — everything a line points at already exists, so the list never creates reference rows the way a recipe save does.
- Merging is the caller's job, not the table's: the repository appends what it is given. `mergeIntoList` (M31.2, pure, in `src/domain/shopping.ts`) is what merges an addition by `(food, unit)` into an unticked line and appends a source to it.
- Grouped by `aisle` on the page, in `aisle.position` order with unassigned last. Foods with `skip_shopping` are never added.
- Until unit conversions exist (M32), 1 cup flour and 300 g flour are two lines. Known and accepted.

## Meal plan

One plan for the household, with no owner and no plan table (decisions.md row 71), and **days rather than meals**: there is no entry type, and a day holds as many entries as it holds. `007_plan.sql` builds it; the document is `src/domain/plan.ts`, the repository `src/db/models/plan/repo.ts`, the server functions `src/server/plan.ts`.

- An entry is a recipe entry (`recipe_id`, with `servings` optionally overriding the recipe's own) or a plain line (`text`, "leftovers", "out"). One table holds both, as `shopping_item` does.
- `date` is a calendar date, `YYYY-MM-DD`, with the same GLOB check `timeline_event.occurred_on` carries. `position` is the order within that day, and is not unique: a move rewrites a day's rows in one transaction.
- `recipe_id` sets null rather than cascading: deleting a recipe must not silently empty a planned day, and the entry survives as the plain line it becomes.
- Mealie's `entry_type` (breakfast / lunch / dinner / side) and Tandoor's meal types are the one deliberate divergence: this household plans "what are we eating on Thursday", and a second axis of slots does not fit a phone.
- A week is the unit read: `week(monday)` answers seven `PlanDay`s, Monday first, **empty days included** — an empty Wednesday is part of the answer. Dates are arithmetic on strings in UTC (`addDays`, `mondayOf`, `weekDates`, `groupByDay` in `src/domain/plan.ts`, pure).
- The document nests `recipe` with only what the week strip draws — id, slug, name, image — one select per week, not one per entry. An entry whose recipe has been deleted reads back with `recipe: null` and keeps its day. Writes send `recipeId`.
- No copied recipe name, unlike a shopping source: a plan is read for the week it names, not asked weeks later where a line came from.

## API

- **Server functions** (`createServerFn`) for everything the app itself calls, one file per resource in `src/server/`. Input validated with the shared zod schemas. Reads use `method: 'GET'` so they are cacheable; writes are `POST`.
  - `recipes`: `listRecipes({ q?, tag?, tags?, match?, foods?, favourite?, sort?, dir?, seed? })` (card summaries), `getRecipe({ slug, servings? })`, `createRecipe(doc)`, `updateRecipe({ id, doc })`, `duplicateRecipe({ id })`, `setFavourite({ id, favourite })`, `deleteRecipe({ id })`.
    - Filters combine with AND: name substring, tag slugs (`match: 'any' | 'all'`, default any; the older singular `tag` folds in), food ids, favourites-only.
    - `sort` is `name | created | updated | lastMade | rating | random`, with `dir` defaulting per key and nulls last. `random` takes a `seed` so the same URL keeps the same order. Unsorted is newest first.
    - Summaries carry what the card draws: name, slug, image, rating, tags, `favourite`, `lastMade` and `totalTime`.
  - `timeline`: `listTimeline({ recipeId })` (newest first), `createTimelineEvent({ recipeId, event })`, `deleteTimelineEvent({ id })`. Both writes recompute `recipe.last_made`.
  - `shopping`: `listShoppingItems()`, `addShoppingItems({ items })`, `updateShoppingItem({ id, ...patch })`, `tickShoppingItem({ id, ticked })`, `removeShoppingItem({ id })`, `clearTickedShoppingItems()`, `reorderShoppingItems({ ids })`. No list id anywhere: there is one list.
  - `plan`: `listPlanWeek({ monday })` (seven days), `addPlanEntry({ date, recipeId?, text, servings? })`, `updatePlanEntry({ id, ...patch })`, `movePlanEntry({ id, date, position })`, `removePlanEntry({ id })`. No plan id and no meal type: there is one plan, and the day is the slot.
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
  - `GET /api/recipes/:slug.json`: one recipe's document as the editor saves it, with `image` as its `/api/images/` URL. 404 for an unknown slug.
  - `GET /api/export.json`: every recipe's document plus the `foods`, `units`, `aisles` and `tags` lists, under a `garnish: { version, exportedAt }` envelope, offered as a download named for the day. Images are referenced by URL, never inlined; the database stays the master (decisions.md row 72). Settings' Export tab links to it.
  - `POST /api/import/file`: multipart, the export in the `file` field, 100 MB cap. Reads a Mealie backup zip or one recipe's JSON (`src/domain/importMealie.ts`, decisions.md row 73), or a Tandoor export — its zip of per-recipe zips, one recipe's zip, or a bare `recipe.json` (`src/domain/importTandoor.ts`, M34.4) — told apart by shape rather than by file name, and answers `{ recipes: [...] }` for the review step. A Tandoor step becomes a part, owning its ingredients and linking them to its own instruction; a nested-recipe step becomes a food row when the child came with it and a text line when it did not. Nothing is written — the review is what decides and the editor's Save is what writes.
  - `GET /api/recipes/:slug.cook`: the recipe as a Cooklang file (`src/domain/cooklang.ts`'s `toCooklang`), `text/plain; charset=utf-8`. 404 for an unknown slug, same as the JSON twin. The recipe menu's "Copy as Cooklang" reads the same function client-side rather than fetching the route.
  - The `.json` and `.cook` suffixes are path suffixes, not params: the file routes are named `export[.]json.ts`, `{$slug}[.]json.ts` and `{$slug}[.]cook.ts`, where `[.]` escapes the dot the file convention would otherwise split on and the braces end the param.
- Recipe read returns the full nested document: recipe, parts, ingredients, steps, notes, tags. `favourite` is part of it; timeline events are read separately.
- Recipe write accepts the same document. One transaction, whole recipe replaced, `id` and `created_at` kept. Slug derived from the name, de-duplicated with a suffix.
- Route loaders are the only read path and call server functions directly; there is no client cache and TanStack Query is not added. Mutations go through `src/lib/mutate.ts`: call the server function, then `router.invalidate()` so every active loader re-runs.

## Frontend

- Routes: `/` (list; `q`, `tag`/`tags`, `match`, `foods`, `favourite`, `sort`, `dir`, `seed` search params), `/recipes/new`, `/recipes/$slug` (`?servings=`), `/recipes/$slug/edit`, `/recipes/$slug/cook` (`?servings=&step=`), `/settings`. Search params are zod-validated and feed the loader, so the URL is the state — except `servings`, which the recipe and cook pages read straight from the search and apply themselves (see Scaling), and `step`, which is only a card index.
- Shell: bottom nav on phones, side nav from `md` up. Cook mode opts out with `staticData.fullscreen`. Router-wide pending, error and not-found views (`src/components/RouteStates.tsx`) built from design system pieces; a design system `ErrorBoundary` around the shell is the last line of defence; every list sits in an `EmptyBoundary`. A failed fetch is shown as "can't reach the server" with Retry, or "you are offline" when the browser knows. One design system `Toaster` is mounted in `__root.tsx`; saves, deletes and upload failures report through `notify()` (`src/lib/notify.ts`) rather than inline copy.
- Client stores, all guarded with try/catch so a blocked or full storage degrades to defaults:
  - `src/lib/prefs.ts` — localStorage, per device: list view mode, sort, structured/summary ingredients, theme, screen-awake.
  - `src/lib/ticks.ts` — sessionStorage, keyed by recipe id: which ingredients and steps are ticked. Shared by the view page and cook mode.
- List: cards carry image, name, rating stars, total-time chip, up to three tags with `+N`, and a favourite heart that writes through `setFavourite` optimistically. Grid and list modes, scroll position restored on back. Filter bar (tag chips with an any/all switch, food `Combobox`, favourites toggle), sort menu and a dice button that opens one random recipe. `/` outside an input opens a global search dialog over `listRecipes` with arrow-key selection and Enter to open.
- Recipe view: header with the image beside the text from `md` and stacked below, name, rating, description, tags, a prep/cook/total stat strip and a yield line; footer carries the source link and the created and updated dates. Ingredient rows follow Mealie (quantity, unit, **bold** food, dimmed note, `fixed` marker) with a tick box each, and a Structured/Summary switch between per-part blocks and one merged list (`mergeIngredients` in `src/domain/merge.ts`). Steps tick to dim and collapse; step text renders through a safe markdown subset (`src/domain/markdown.ts`: paragraphs, bold, italics, lists, no raw HTML). A "Serves N" chip with − / + and a number popover scales, as does "Scale to…" on an ingredient row (`servingsForTarget`). A `Menu` holds Edit, Cook, Duplicate, Copy link, Copy ingredients, Print and Delete; Print is a `@media print` block in `styles.css`, not a second route.
- Made this: a `sheet` beside last-made takes a date, a comment and an optional photo; the timeline sits under Notes, newest first, each event deletable. It is also the cook mode finish card's shortcut.
- Cook view: the recipe as a deck of cards (`src/domain/cook.ts`): per part, one ingredients card then one card per step. One card at a time, large type, scale control always visible. Part pills jump between parts, arrow keys and vertical swipe (`swipeIntent` separates a swipe from a scroll) move, and an ARIA live region announces the card. Ingredient items tick through the shared store. The last card is "Finished", with Made this and Exit. Screen wake lock held while mounted (`src/lib/useWakeLock.ts`), silent where unsupported.
- New recipe: `/recipes/new` asks where the recipe is from (decisions.md row 57) — **a web page**, or **your own** — and `?source` carries the answer, so each stage is somewhere Back leaves the way it leaves any other screen.
- URL import: `importFromUrl` (`src/server/recipeImport.ts`) GETs the page server-side, because the browser cannot for CORS, with a browser `User-Agent`, a 15 s timeout and a 5 MB cap. Then two rungs (row 58): `jsonLd.ts` finds a schema.org Recipe in the page's `ld+json`, flattening `@graph` and top-level arrays and surviving a malformed block, and `schemaRecipe.ts` normalises it — image, yield, ISO-8601 durations, keywords, ingredient lines, and `HowToSection` as **named parts** (row 59). Failing that, `openGraph.ts` builds a stub from `og:title`/`og:description`/`og:image`: a named, illustrated, linked shell with empty lists, which is Mealie's last non-AI rung and better than Tandoor's outright error. A Recipe node with no ingredients and no steps counts as a miss, so an SEO shell falls through to the stub. No per-site scrapers: intent.md names those as a hole this project exists to avoid. The review is the M17.5 rows, so an unknown food is still a proposal declined by default, and Create fills `sourceUrl` and fetches the page's image into the same upload path a picked file uses. `recipeBySource` warns when the same address is already here (Tandoor's behaviour), without blocking.
- Editor: the order is the view page's order (decisions.md row 50) — image, name, description, servings, then the parts, then notes, then a `Details` disclosure holding yield, times, tags and the source URL, folded on a new recipe and open on one that has any of it. Rating and last made are not in the form at all; they belong to the view page and the timeline (row 51). An `EditorToolbar` heads the page with the recipe's name, the dirty note, "Edit as JSON" and the save, sticky from `md` up; `SaveBar` keeps the phone footer and hides from `md`.
- Editor parts: a recipe with one unnamed part prints its two lists bare — no name field, card, heading or reorder handle (row 53) — and "Add part" gives every part its chrome. Each part has an ingredient list and a step list; there is no step list outside a part. Unit and food autocomplete with find-or-create, and Enter in either takes the typed name as a new reference when the list is closed (row 55); a text-only ingredient row saves as Mealie's disable-amount case. Enter on an ingredient row's last field, and ⌘/Ctrl+Enter in a step's textarea, append a row and focus it from the last row and move to the next from any earlier one (`src/lib/rowKeys.ts`). Below `md` an ingredient row collapses to one summary line with a chevron that opens a `sheet` over the same fields; from `md` up the inline row stays and shows `originalText` in grey above a parsed row. `ReorderList` drags by a handle (pointer events, 250 ms touch delay) within a list and between parts, with the up/down buttons and "Move to" kept.
- Editor lists: row actions are in one `⋮` per row and list actions sit once in the section header (row 54). A step's menu holds preview, insert above/below, split by paragraph, merge with next and delete; the header holds Split all, Merge all, Bulk add and Add step. The ingredient header holds Bulk add; a part where nothing has resolved to a food heads its list with a "Parse all" banner that reads every text-only row through `parseIngredient` and reviews them in one sheet. A step row previews its markdown in place through `Markdown` (row 56). The image field accepts a pasted URL via `fetchImage`. "Edit as JSON" swaps the form for the document, applied through `recipeInputSchema`. Dirty tracking, a `useBlocker` confirm on route leave and a `beforeunload` prompt.

- Settings: design system `tabs` — Foods, Units, Aisles, Tags, Export, Appearance — over one local `DataTable` (search, sortable columns, edit `sheet` from a field spec, delete confirm listing the affected recipes). Foods and Units also merge into a target; Aisles reorder by drag; Tags group A–Z and click through to the filtered list. Export links at `/api/export.json` and says the file does not carry the image bytes. Appearance holds the light / dark / system theme toggle.
- Theme follows the pref, falling back to the system, via the design system's `bootstrapTheme` and `data-theme`; an inline script sets the attribute before first paint. Fonts: Inter and JetBrains Mono, self-hosted via fontsource.

## PWA

- Installable: `public/manifest.webmanifest`, SVG and PNG icons drawn from the brand tokens, Apple metas in the root route.
- Service worker: hand-written (`src/sw/worker.ts`), no workbox. `src/sw/plugin.ts` bundles it with `Bun.build` and emits `sw.js` as an asset of the client build, because Nitro serves static files from a manifest baked at build time and a file dropped in afterwards is a 404 (decisions.md row 37). Registered in production only (`src/lib/sw.ts`); dev has no `/sw.js`.
- Policies: navigations go to the network and fall back to the cached shell; built assets and `public/` are cache-first (precached at install); `GET /_serverFn/*` and `/api/images/*` are network-first and stored on success, so a recipe read while online opens offline. Two caches: a versioned precache replaced on every deploy, and one data cache that survives deploys.
- Writes are never attempted offline. `useOnline` shows a notice in the editor and disables Save.

## Persistence rules

- `DATA_DIR` (default `./data`) holds `garnish.db`, `images/` (with `images/timeline/`) and `backups/`. It is created on boot if missing.
- Migrations are numbered SQL files in `src/db/migrations/`, applied in order by `migrate.ts` beside them, each in its own transaction with its `migration` row. They run at boot and via `bun run migrate`. The built server has no source tree, so `src/server/db.ts` inlines them with `import.meta.glob` (decisions.md row 38); the CLI reads the directory. Opening a database is separate (`src/db/connection/open.ts`), so backing up or seeding does not pull the runner in.
- Each domain folder under `src/db/models/` has a `schema.ts` declaring its tables in TypeScript, and the repositories import the tables they touch directly — there is no barrel, because Drizzle's `schema` option only powers the relational query API (`with:`), which nothing uses. `drizzle.config.ts` and the drift test find the tables with a glob. It is a mirror, not a second migration source: the SQL files still build the database, and `test/db/drift.test.ts` migrates a real one and fails if the two disagree on tables, columns, types, nullability or primary keys. A new migration is written by hand or generated with `bun run db:generate` (drizzle-kit writes to `.drizzle/`, which is gitignored), reviewed, then copied into `migrations/NNN_name.sql` — generated SQL is never applied as-is, because Drizzle cannot express the `COLLATE NOCASE` the name columns rely on.
- Repositories query through Drizzle rather than hand-written SQL, so row types come from the schema instead of being restated per file. The store, the handle and its lifecycle are unchanged: Drizzle wraps the connection `openDatabase` returns.
- One process-wide handle (`getDb()`), opened lazily, migrated and seeded once, retried on failure.
- Backup is a copy of the database file, taken via `VACUUM INTO` so it is consistent: `bun run backup` writes `DATA_DIR/backups/garnish-YYYYMMDD-HHmmss.db` (UTC). Restore is a file copy with the WAL sidecars removed; README.md has the steps.
- No file export in v1. The database is the only store.
- Dev data is a separate thing from the seed and never ships: `.dockerignore` excludes `src/db/dev` from the build context, which is also why the reset is wired into `bun run dev` rather than the server entry — `src/server.ts` cannot import a directory the image build does not carry.
- `bun run dev:seed [--count N] [--seed TEXT]` is a clean slate in three steps: wipe `DATA_DIR`'s database, its WAL sidecars and `images/` (`wipe.ts`; backups are left alone); migrate and run the same `seed()` the server runs on every start, dev or not, so dev looks at the reference data a real install has rather than a parallel set; then apply the generated dataset. Deleting the file rather than the rows is deliberate — it takes the schema with it, so a migration edited in place is re-applied instead of skipped for having a `migration` row already. It refuses to run under `NODE_ENV=production`.
- `bun run dev` runs `dev:seed` and then starts Vite (~1.5 s, once per invocation: a `vite.config.ts` edit restarts Vite in-process and does not re-run the script). `bun run dev:keep` starts Vite without touching the database.
- The generated dataset is deterministic from its seed, so the same run always lands in the same state. `apply.ts` owns its rows by id rather than by name, so it can be used on its own against a database it does not own without taking hand-written recipes with it; under `dev:seed` there is nothing left to collide with. The mix is chosen for coverage: a flat recipe and multi-part ones, unrated, never-made, image-less, long-named, one-ingredient and fourteen-ingredient cases, tags spread unevenly, and created/updated stamps fanned across two years so every sort key has something to order. Placeholder images are generated PNGs (`png.ts`), because the cards and cook mode read wrong with every image missing.
- Seed: fifteen metric and common imperial units, matched by name case-insensitively so re-seeding never overwrites edits. Runs at boot and via `bun run seed`. `bun run seed --sample` adds three demo recipes (one with three parts), idempotent by slug: one is favourited, one carries a source URL and one has two timeline events, so every stage 2 screen has data. Foods and aisles start empty. `src/db/seed/` keeps the data (`units.ts`, `recipes.ts`, `timeline.ts`) apart from the inserting (`seed.ts`) and the CLI (`cli.ts`).
- Locale: metric, en-AU spelling. Imperial units available, never default.

## Deploy

- Two-stage `Dockerfile` on `oven/bun:1.4.2` (install and `bun run build`) then `oven/bun:1.4.2-slim` with only `.output/`. `bun:sqlite` is built into Bun, so nothing else is installed at runtime.
- `DATA_DIR=/data` is the volume; `PORT=3000`, `HOST=0.0.0.0`. Runs as root, like Mealie's default, so a bind-mounted host directory needs no ownership setup.
- `HEALTHCHECK` fetches `/api/health` with Bun itself (the slim image has no curl).
- `docker-compose.yml`: one service `garnish`, port 3000 published, named volume `garnish-data` at `/data`, `restart: unless-stopped`.

## Non-goals

Inventory, nutrition, costing, native app, multi-tenancy, public exposure. See [intent.md](intent.md).

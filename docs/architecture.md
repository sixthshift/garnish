# Architecture

How garnish is built. Decisions and their alternatives are in [decisions.md](decisions.md); what ships when is in [scope.md](scope.md).

## Shape

- One Bun process. TanStack Start on Nitro's Bun preset serves the app, server functions and `/api/*` routes.
- One SQLite file. `bun:sqlite`, WAL mode, foreign keys on.
- One Docker container. The SQLite file lives on a mounted volume.
- LAN only. No auth, no users, no accounts.

```
browser (PWA) ──server fns / HTTP──▶ TanStack Start (Nitro, Bun) ──▶ bun:sqlite ──▶ garnish.db (volume)
```

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Framework | TanStack Start, SPA mode, file routes in `src/routes/` |
| Build | Vite via `bun --bun vite`; Nitro Bun preset for production |
| Frontend | React 19 + Tailwind 4 via `@tailwindcss/vite` |
| UI kit | `@sixthshift/design-system`, subpath imports. Gaps (stepper, reorder list, image upload) built locally from its primitives |
| Storage | SQLite (`bun:sqlite`) |
| Validation | zod, one schema per document, shared by API and editor |
| IDs | UUID, plus slug on recipe (Mealie) |
| Tests | `bun test` |
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
```

- A recipe is an ordered list of components. Every recipe has at least one; a single unnamed component is the flat case.
- Each component owns its ingredients. Same food in two components is two rows.
- Steps belong to the recipe and may point at a component. A component can hold several steps.
- `quantity` null means "no amount" (salt to taste). `fixed` true means "has an amount, does not scale" (one egg wash). Cooklang's `=`.
- `food_id` and `unit_id` are nullable. A line that is only text still saves. `original_text` is always kept.
- Servings and yield: `servings` and `yield_quantity` are numbers and scale; `yield_text` is display. Mealie's three fields. `yield_unit_id` lets a parent later ask for "150 ml of this".
- Sub-recipes attach to the **food**, not the ingredient row: `food.recipe_id`. An ingredient line reads "150 g hollandaise" and does not care whether hollandaise has a recipe. Tandoor's shape. Scaling through it is deferred, see [scope.md](scope.md).
- `food.skip_shopping` for water, salt, pepper. `aisle` is its own table. `unit.standard_*` is the hook for conversions later.
- Quantities are stored as decimals. `unit.fraction` says whether to render ½ or 0.5.
- Images live on the disk volume, referenced by path. Not in the DB.

## Scaling

- `factor = target_servings / recipe.servings`
- Linear ingredients multiply by `factor`. Fixed ingredients do not.
- Timers and cookware never scale.
- Scaling is computed on read. Nothing scaled is persisted.

## Shopping list

- Aggregates ingredients across selected recipes.
- Merges by `(food, unit)` into one line. Each line expands to its sources: recipe, component, quantity. Mealie's `recipeReferences` per item.
- Until unit conversions exist, 1 cup flour and 300 g flour are two lines. Known and accepted.
- Grouped by `aisle`. Foods with `skip_shopping` are omitted.

## API

- **Server functions** (`createServerFn`) for everything the app itself calls: recipe CRUD, list, scale, reference lists. Input validated with the shared zod schemas. Reads use `method: 'GET'` so they are cacheable.
- **Server routes** under `/api/*` only for callers outside the app: `/api/health`, `/api/images/*`, and later import hooks. Field names follow Mealie where the concept exists.
- Recipe read returns the full nested document: recipe, components, ingredients, steps, notes, tags.
- Recipe write accepts the same document. One transaction, whole recipe replaced.
- Route loaders call server functions; TanStack Query is not added unless a task proves it necessary.

## Frontend

- Responsive PWA, phone first. SPA shell prerendered by Start; service worker caches the shell, recipe reads and images. Installable, offline read, wake lock in cook view.
- Cook view: one component at a time, large type, scale control always visible.
- Editor: components are the primary unit. Each has an ingredient list and a step list. Add, rename, reorder, move ingredients between them.
- Theme follows the system via the design system's `data-theme`. Fonts: Inter and JetBrains Mono, self-hosted via fontsource.

## Persistence rules

- Migrations are numbered SQL files applied in order, recorded in a `migration` table.
- Backup is a copy of the database file, taken via `VACUUM INTO` so it is consistent.
- No file export in v1. The database is the only store.
- Seed: metric and common imperial units. Foods and aisles start empty.
- Locale: metric, en-AU spelling. Imperial units available, never default.

## Non-goals

Inventory, nutrition, costing, native app, multi-tenancy, public exposure. See [intent.md](intent.md).

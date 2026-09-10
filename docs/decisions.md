# Decisions

One line each. Newest at the bottom. Reverse a decision by adding a new row, not editing the old one.

| # | Decision | Chosen over | Why |
|---|---|---|---|
| 1 | Build, not deploy | Mealie, Tandoor, cookcli | None has components as real objects with a phone-first UI. cookcli comes closest but its import is OpenAI-only and its UI is secondary |
| 2 | Bun | Node | Single runtime for server, bundler, SQLite, tests |
| 3 | SQLite is the only store | Cooklang files; files + SQLite index; Postgres | Robust and versatile as features grow. Files can't enforce references. One writer, so Postgres buys nothing |
| 4 | No file export in v1 | Continuous git-tracked export | Recipes are mastered in the DB. Export is a later feature, not a design constraint |
| 5 | React + Tailwind via Bun HTML imports | Svelte, HTMX, vanilla | Largest ecosystem for PWA work. No Vite |
| 6 | No auth, no users | Single household login; per-member accounts | LAN only. Nothing in v1 needs identity. Meal plans and lists are household-wide |
| 7 | Mealie schema outside recipe internals | First-principles design | Years of settled decisions in a public OpenAPI spec |
| 8 | Tandoor shape inside recipes: components own ingredients | Mealie flat array with a `title` flag | A flag is cosmetic and the parser drops it. A table can't be bolted on later |
| 9 | Cooklang as a reference, not a store | Cooklang as source of truth | Its sections, `=` fixed quantities, servings scaling and aisle config are borrowed. Its files are not |
| 10 | No AI in v1 | Claude import via `claude -p` | Library and scaling first. Schema is designed so import returns the same document the editor saves |
| 11 | When AI arrives, it runs as `claude -p` on subscription | Anthropic API key; Agent SDK | Subscription tokens. Agent SDK is API-key only. Verified against Claude Code docs 2026-09 |
| 12 | Docker, single container, one volume | Bare Bun on a host | Portable. `claude -p` in a container will need a `claude setup-token` injected |
| 13 | Shopping list merges by food and unit, expandable to sources | Never merge; merge without breakdown | Usable list, provenance kept |
| 14 | Recipe-to-recipe references deferred | Track live; pin; ask on edit | Open. Schema leaves room via `component.ref_recipe_id` |
| 15 | Scaling computed on read | Persist scaled copies | Nothing to keep in sync |
| 16 | Quantities stored as decimals | Fraction strings | Arithmetic is exact enough; fractions are display |
| 17 | Mealie is the tie-breaker | Deciding from scratch | When unsure, do what Mealie does |
| 18 | UI is `@sixthshift/design-system` | Raw Tailwind; shadcn direct | Personal design system. Missing primitives built locally in garnish, promoted later if generic |
| 19 | Sub-recipe link lives on `food`, not `ingredient` | `ingredient.ref_recipe_id`; `component.ref_recipe_id` | An ingredient line shouldn't care whether hollandaise has a recipe. Tandoor's `Food.recipe`. Supersedes 14's slot |
| 20 | Servings and yield: two numbers plus a string | Free text only | Mealie's `recipeServings`, `recipeYieldQuantity`, `recipeYield`. Numbers scale, string displays |
| 21 | Ingredient `quantity`, `food`, `unit` nullable; `original_text` kept | Required fields | Mealie does this. Parsing is never complete; text-only lines must save |
| 22 | Component holds ingredients and steps as two lists | Tandoor's one step = one ingredient group | Cook view shows one short step at a time. Editor cost accepted |
| 23 | Aisle is a table; `food.skip_shopping` flag | Aisle string on food | Mealie labels and Tandoor supermarket categories are both tables. Tandoor's `ignore_shopping` |
| 24 | zod for validation | TypeBox, Valibot | Nearest to Mealie's pydantic. One schema per document |
| 25 | UUID ids, recipe slugs | Integer ids | Mealie |
| 26 | Images on the volume, not in SQLite | Blobs | Mealie stores files on disk |
| 27 | Metric, en-AU default; seed units only | Imperial; seed foods from Mealie | Household preference. Foods accrue from use |
| 28 | TanStack Start is the framework | Bun HTML imports + hand-rolled `Bun.serve` routes | Jason's call. File routing, typed server functions, SSR/SPA toggle. Supersedes 5's "no Vite": Vite runs via `bun --bun`, Nitro Bun preset in prod. RC status accepted |
| 29 | SPA mode | Full SSR | LAN app, no SEO. Prerendered shell plus cached data is the standard offline PWA shape |
| 30 | Server functions for app calls, server routes only under `/api/*` | REST for everything | Type safety end to end. `/api/*` kept for health, images, and future external import |

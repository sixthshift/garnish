# Intent

Why garnish exists and what it refuses to do. Vision, not spec: when this file and the code disagree, the code is right and this is stale.

Architecture: [architecture.md](architecture.md). Decision log: [decisions.md](decisions.md). What ships when: [scope.md](scope.md).

## What it is

A personal recipe manager for one household. LAN only. Not a product.

The goal is the best of the existing tools, assembled: take each incumbent's strongest decision, leave its weakest.

## Why not deploy one

| Tool | Best at | Where it stops |
|---|---|---|
| **Mealie** | Polish, URL import, single container | Ingredient sections are a `title` flag the parser deletes |
| **Tandoor** | Depth: ingredients on steps, nutrition, costing | Needs Postgres. Nested recipes don't scale with the parent |
| **KitchenOwl** | Households, native app, live shopping list | Weak as a library |
| **Grocy** | Inventory | Recipes are a bolt-on |
| **Nextcloud Cookbook** | Durability, JSON on disk | Needs Nextcloud |
| **RecipeSage** | Import/export | Thin self-host community |
| **Recipya** | Single Go binary | Bus factor of one |
| **Cooklang / cookcli** | Plain text, sections, recipe references with scaling, shopping lists, LLM import | Files as the store. Web UI is secondary. Import is OpenAI-only |

Shared holes, which switching doesn't fix:

1. Scrapers rot per site.
2. Ingredient parsing is unsolved by regex.
3. Mobile is an afterthought everywhere except KitchenOwl.

## The shape of a recipe

- A recipe is an ordered list of named parts. Each owns its ingredients and its steps; the unnamed part is the recipe's main body.
- Tandoor's shape, Cooklang's sections. One design decision among several, not the reason the project exists.
- Worth stating because Mealie gets it wrong, and a flag can't become a table later.

## Why buildable now

The hard parts were never the CRUD app. They were the scraper and the parser. An LLM does both from page text against a strict schema. That is deferred past v1, but the schema is designed for it.

## Decisions

See [decisions.md](decisions.md). The load-bearing ones:

- SQLite is the only store. Cooklang is a reference, not a format we write.
- No auth, no users.
- No AI in v1. When it comes, it runs as `claude -p` on subscription.
- Docker, one container, one volume.

## Won't do

- Multi-tenancy, public instance, accounts.
- Inventory. Grocy exists.
- Native app. Responsive PWA with offline read and wake lock.
- Feature parity for its own sake.

## Known limits

- **One maintainer who will get bored.** Recipe data is decade-scale. Backup is a file copy; export is a later feature and the mitigation when it lands.
- **The phone is where DIY recipe apps die.** If the PWA is bad, the data model doesn't matter.
- **The name is wrong on purpose.** A garnish is the least essential part of a dish. Chosen for sound.

## Open

- Recipe-to-recipe references and how parents react to child edits.
- External authoring, closed unless export becomes bidirectional.

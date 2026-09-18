# Scope

## v1

- Recipe library: list, search by name and tag, view.
- Recipe editor: parts, ingredients, steps, tags, servings, times, image.
- Import from a URL: schema.org `ld+json` where the page has it, an OpenGraph stub where it does not, reviewed before it is saved. No per-site scrapers, no AI (decisions rows 57, 58).
- Scaling with fixed-quantity support.
- Cook view: per-part, wake lock, scale control.
- PWA: installable, offline read of cached recipes.
- Foods, units, aisles: managed lists, autocomplete in the editor. Units seeded, metric default.
- Rating, notes, last made.
- Docker image, SQLite on a volume, backup command.

## Shipped since v1

Stages 7 to 13, in the order they were built. The argument for each is in [decisions.md](decisions.md); how they were built is in [plan.md](plan.md).

- Shopping list (stage 7). One household list, merged by food and unit, expandable to its sources, grouped by aisle, added to from the recipe at the page's scale. Opens, ticks and takes a typed line offline through the outbox, the app's first queued write (decisions rows 68 and 104).
- Sub-recipes and conversions (stage 8). Conversions per food, so 1 cup flour and 300 g flour merge; a food made by a recipe links to it and scales through it. See Open, below, for what is left.
- Meal plan (stage 9). A week of days, a recipe or a plain line on each, the week addable to the list in one tap.
- Out and in (stage 10). JSON and Cooklang export; import from Mealie and Tandoor backups, the adoption path neither incumbent offers.
- Small parity items (stage 11). Step photos, servings on a logged cook, an ingredient preview on the card, and a second browser profile for a fetch that meets a bot wall.
- Import as one pipeline (stage 12). Fetch the page, extract what the rules can (JSON-LD, OpenGraph, readable text), read it with a hosted model over an OpenAI-compatible endpoint using the JSON-LD as an anchor, check the answer against that anchor word for word, review it before anything is saved. The model supplies the parts the markup cannot; the page keeps the words. With no key configured the rules result is the whole of it, and pasted prose goes through the same read.
- Share to garnish. The installed app is a share target: a URL shared from the phone's browser opens the import on it and reads the page at once (decisions row 103).
- The house style (stage 13). A guide of short statements in Settings and a Restyle pass that rewrites steps into the household's voice, held to a facts check and approved per part.

## Later, in rough order

- In-editor AI help: unit conversion, rewording, substitutions.
- File export back in: `/api/export.json` is one-way, and `readExport` reads Mealie and Tandoor but not garnish. Backups cover the database, not `images/`, and there is no restore command.
- A DOM test environment, so an interaction can be tested rather than read (the stage 5 question, still open).

## Open

- **Sub-recipes.** A food may point at a recipe (`food.recipe_id`), and a parent scales through it: the link, the derived servings, cooking through it and expanding it into the shopping list all shipped in stage 8. Two questions are left. Nesting past one level: expanding a child stops at the child's own sub-recipe rows, and nothing guards a cycle because nothing recurses. And how a parent reacts to a child's edits: nothing is cached or pinned, so changing a child's yield silently re-scales every parent, which is either the point or a trap.
- **External authoring.** Closed for now by choosing the DB as the only store. Reopens only if file export becomes bidirectional.

## Never

- Multi-tenancy, public instance, accounts.
- Inventory or pantry tracking.
- Native app.
- Feature parity with incumbents for its own sake.

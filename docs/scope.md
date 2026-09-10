# Scope

## v1

- Recipe library: list, search by name and tag, view.
- Recipe editor: components, ingredients, steps, tags, servings, times, image.
- Scaling with fixed-quantity support.
- Cook view: per-component, wake lock, scale control.
- PWA: installable, offline read of cached recipes.
- Foods, units, aisles: managed lists, autocomplete in the editor. Units seeded, metric default.
- Rating, notes, last made.
- Docker image, SQLite on a volume, backup command.

## Later, in rough order

- Shopping list. Merge rule decided: by food and unit, expandable, grouped by aisle.
- Unit conversions per food, so 1 cup flour and 300 g flour merge.
- Import via `claude -p`: URL and pasted text, reviewed before save.
- Meal planning, feeding the shopping list.
- File export, format undecided. Cooklang is the obvious candidate.
- In-editor AI help: unit conversion, rewording, substitutions.

## Open

- **Sub-recipes.** A food may point at a recipe (`food.recipe_id`). How a parent scales through it, and how it reacts to child edits, is not designed. Schema keeps the slot only.
- **External authoring.** Closed for now by choosing the DB as the only store. Reopens only if file export becomes bidirectional.

## Never

- Multi-tenancy, public instance, accounts.
- Inventory or pantry tracking.
- Native app.
- Feature parity with incumbents for its own sake.

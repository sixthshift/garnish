# Scope

## v1

- Recipe library: list, search by name and tag, view.
- Recipe editor: parts, ingredients, steps, tags, servings, times, image.
- Import from a URL: schema.org `ld+json` where the page has it, an OpenGraph stub where it does not, reviewed before it is saved. No per-site scrapers, no AI (decisions rows 57, 58).
- Scaling with fixed-quantity support.
- Cooking from the recipe page: the page folded to one header line, Now on the step being cooked, an assistant, a review of tonight's changes, wake lock (decisions.md row 214).
- PWA: installable, offline read of cached recipes.
- Foods, units, aisles: managed lists, autocomplete in the editor. Units seeded, metric default.
- Rating, notes, last made.
- Docker image, SQLite on a volume, backup command.

## Shipped since v1

Stages 7 to 15, in the order they were built. The argument for each is in [decisions.md](decisions.md); how they were built is in the git history.

- Shopping list (stage 7). One household list, merged by food and unit, expandable to its sources, grouped by aisle, added to from the recipe at the page's scale. Opens, ticks and takes a typed line offline through the outbox, the app's first queued write (decisions rows 68 and 104).
- Sub-recipes and conversions (stage 8). Conversions per food, so 1 cup flour and 300 g flour merge; a food made by a recipe links to it and scales through it. One level only; nothing further is planned (decisions row 130).
- Meal plan (stage 9). A week of days, a recipe or a plain line on each, the week addable to the list in one tap.
- Out and in (stage 10). JSON and Cooklang export; import from Mealie and Tandoor backups, the adoption path neither incumbent offers.
- Small parity items (stage 11). Step photos, servings on a logged cook, an ingredient preview on the card, and a second browser profile for a fetch that meets a bot wall.
- Import as one pipeline (stage 12). Fetch the page, extract what the rules can (JSON-LD, microdata, OpenGraph, readable text), read it with a hosted model over an OpenAI-compatible endpoint using the JSON-LD as an anchor, check the answer against that anchor word for word, review it before anything is saved. The model supplies the parts the markup cannot; the page keeps the words. With no model selected the rules result is the whole of it, and pasted prose goes through the same read.
- Share to garnish. The installed app is a share target: a URL shared from the phone's browser opens the import on it and reads the page at once (decisions row 103).
- The house style (stage 13). A guide of short statements in Settings and a Restyle pass that rewrites a recipe's method into the household's voice — its steps' labels, texts and supporting lines, and its ingredients' notes — held to a conservation check and chosen step by step in a Style space of its own: the import's stage before Save when a model is configured, and a saved recipe's Style page after (decisions row 119).
- Backup and restore (stage 15). The whole household as one zip, photos included, from Settings or `bun run backup`; a restore replaces everything after checking the whole file and keeping the database and photos as they were, from Settings behind a tick-to-confirm or `bun run restore`. Export is one recipe, as JSON or Cooklang (decisions row 131).
- An MCP server. Any AI assistant that speaks MCP — Claude on the web, the phone or Claude Code, ChatGPT, or another — reads and changes recipes, the shopping list and the meal plan through an MCP server, let in once with a pairing code from Settings › MCP and disconnected from Settings › MCP; the one door that faces the internet (decisions row 181).
- Timer alerts. A device switched on in Settings › Alerts is woken by a push when a timer ends, screen off or app closed; iPhone from the home screen, Android installed or in Chrome (decisions row 111).
- Four modes, not four drawers. Home is the day as it stands: tonight with Start cooking, the week, what is left to buy, next week, and the recipes never made (decisions row 190); the recipe grid moved to Recipes. Weeknight and Weekend are the Week facet, set like the other layers (row 219). Plan the week fills the open nights, the planner's first pass when a model is selected and the Weeknight recipes otherwise, then the weekend, then the list (rows 192, 194). Cooking happens on the recipe page, which takes changed amounts and steps as you go and asks at Finish which are kept in the recipe (rows 193, 214).
- Alternatives. A line can say what else it can be made with: beef strips or 400 g prawns for the stir-fry's chicken, 1 cup milk and 1 tbsp lemon juice per cup of buttermilk. Each shows under the line at its amount. The ones ticked "The plan picks it" are what the plan rotates through: each new entry takes the one least used before, Choose… on the entry changes it, and the recipe page, cook mode and the shopping list follow the choice (decisions rows 196, 198, 199).
- A browser for the pages a fetch cannot get. When a site blocks a plain download or draws its recipe with JavaScript, the import opens the page in a headless Chromium carried in the image and reads that, then goes on to the same review (decisions.md row 202). taste.com.au, delicious.com.au and Smitten Kitchen wall that off too, so paste and the Save to Garnish bookmark stay as the ways round.

## Later, in rough order

- In-editor AI help: unit conversion, rewording, suggesting alternatives (stored as row 199's).
- Recipe variants: a choice that changes the steps too (prawns 2 minutes, beef seared in batches), built on parts.
- The planner's model choosing the options, with a reason, rather than the weeknight recipes in order.
- Choosing an alternative while cooking or shopping: a change the review at Finish asks about (rows 193, 214), or a list line swapped for it.

## Open

- **External authoring.** Closed for now by choosing the DB as the only store. Reopens only if file export becomes bidirectional.

## Never

- Multi-tenancy, public instance, accounts.
- Inventory or pantry tracking.
- Native app.
- Feature parity with incumbents for its own sake.
- Sub-recipes past one level, or a parent pinned against its child's edits (decisions row 130).
- Sale prices in the planner (decisions row 130).

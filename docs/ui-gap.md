# UI gap: garnish vs the incumbents

Input for the stage 2 plan. Mealie is the default to copy (decision 17); Tandoor and Cooklang where they are better at the thing garnish borrowed from them. Compiled 2026-09-10 from Mealie `mealie-next` frontend source, Tandoor `vue3/` source, CookCLI templates and the Cooklang app docs, against garnish at `e91bc59`.

Legend: **have** = garnish has it · **copy** = adopt with no model change · **model** = needs a new field or table (decisions.md row) · **skip** = out of scope per scope.md, listed so it is not re-raised.

## Already ahead

- Named components owning ingredients and steps. Mealie fakes sections with a `title` string on the first ingredient or step; Tandoor's shape matches ours.
- Fixed (`=`) quantities, with a visible marker. Neither Mealie nor Cooklang badge them.
- Cook mode as one card per component-ingredients then per step. Matches the Cooklang app; Mealie's cook mode is a two-pane scroll.
- Wake lock, offline read, installable PWA, phone bottom nav. Mealie has no bottom nav.

## Recipe list `/`

| Incumbent behaviour | Source | garnish | Action |
|---|---|---|---|
| Card shows image, name, up to 2–3 tag chips, rating, favourite heart | Mealie, Tandoor | image, name, tags | **copy** rating and a total-time chip (Tandoor); favourite is **model** |
| Grid and list view modes, remembered per device | Mealie | grid only | **copy** (localStorage) |
| Filters: tags, foods, categories, tools, with any/all switch | Mealie | single tag | **copy** multi-tag any/all and food filter; categories/tools **model**, see Questions |
| Sort: name, created, updated, last made, rating, random; dice for one random recipe | Mealie | none, newest first | **copy** name/created/updated/rating/random; last made after cook log lands |
| Search box, debounced, query mirrored in URL | Mealie, Tandoor, Cooklang | have | **have** |
| Infinite scroll, scroll position restored on back | Mealie | full list, no restore | **copy** restore; paging unnecessary at household size |
| `/` opens a global search dialog with arrow-key results | Mealie | none | **copy** |
| Create menu: URL import, manual | Mealie | New nav item | import is Later; keep one entry point |

## Recipe view `/recipes/$slug`

| Incumbent behaviour | Source | garnish | Action |
|---|---|---|---|
| Header: image beside text on wide, stacked on phone; name, rating, description, yield, times with icons | Mealie, Tandoor | stacked always, plain `dl` | **copy** the two layouts and the stat strip |
| Times as a strip: prep / cook / total | Tandoor | have as `dl` | **copy** styling |
| Tag chips link to filtered list | all three | have | **have** |
| Ingredient tick boxes, strike through, state in sessionStorage | Mealie, Tandoor | none | **copy** |
| Step done state, tap to dim and collapse | Mealie, Tandoor | none | **copy**, sessionStorage |
| Ingredient row: quantity, unit, **bold food**, note dimmed on its own line | Mealie | one plain line | **copy** Mealie's render |
| Ingredient table columns with note as a tooltip icon | Tandoor | | alternative to the line above; pick one |
| Structured vs Summary toggle: per-component tables or one merged list | Tandoor | per-component only | **copy** as a per-device toggle |
| Ingredients repeated under the step that uses them | Cooklang, Mealie via links | none | **skip** for now; components already scope ingredients to steps |
| Scale chip "Serves N" with − / + and a number popover, reset; yield text scales | Mealie | − / + / Reset | **copy** the number input; **have** the rest |
| Scaled numbers styled differently from base | Tandoor | none | **copy** |
| Scale so one ingredient hits a target amount | Tandoor | none | **copy**, small |
| Action menu: Edit, Delete, Duplicate, Print, Copy link, Add to shopping list | Mealie | Edit and Cook buttons | **copy** Duplicate, Print, Copy link; shopping is Later |
| Print view with preferences | Mealie | none | **copy**, CSS-first |
| Copy ingredients as text | Mealie | none | **copy** |
| Source URL shown in footer, editable | Mealie, Cooklang | field exists, no UI | **have** the field; **copy** the UI |
| Created / updated footer cards | Tandoor | fields exist, no UI | **copy** |
| Last made button opening a "Made this" dialog: date, comment, optional image; feeds a timeline | Mealie | `lastMade` field only, no UI | **model**, see Questions |
| Cook log entry: date, rating, servings, comment; activity list; times-cooked filters | Tandoor | none | **model**, same question |
| Nutrition, assets, comments, share tokens | Mealie | none | **skip**: nutrition is Later at best, the rest is multi-user |
| Timers from durations in step text | Cooklang app, Tandoor | none | **model**; parked until step text is parsed |

## Cook mode `/recipes/$slug/cook`

| Incumbent behaviour | Source | garnish | Action |
|---|---|---|---|
| Section pills at the top to jump between components | Cooklang | progress bar and position label | **copy** |
| Vertical swipe between cards | Cooklang | buttons and arrow keys | **copy** |
| Ingredient card items tick on tap | Cooklang | plain list | **copy**, shares the view page's sessionStorage state |
| Step card repeats that step's ingredients | Cooklang | ingredients card per component only | **skip**, no step links |
| Final "done" card, offering to log the cook | Cooklang, Tandoor | ends on last step | **copy**; the log part depends on the cook log question |
| ARIA live region announcing the card | Cooklang | none | **copy** |
| Screen-awake as a labelled switch, persisted | Mealie | automatic with indicator | **have**; add the switch only if the automatic lock annoys |

## Editor `/recipes/new`, `/recipes/$slug/edit`

| Incumbent behaviour | Source | garnish | Action |
|---|---|---|---|
| Edit in place on the view page (`?edit=true`), sticky Save, floating save when scrolled, discard-changes guard | Mealie | separate route, no guard | see Questions; the discard guard is **copy** either way |
| Ingredient rows drag to reorder and drag between components | Mealie, Tandoor | up/down buttons, "Move to" select | **copy** drag with the buttons kept as fallback |
| Phone: ingredient row is a one-line summary, tap opens a bottom sheet with the fields | Tandoor | full row of inputs on every width | **copy**; this is the single biggest phone-editor fix |
| `originalText` shown in grey above a parsed row | Tandoor | hidden unless text-only mode | **copy** |
| Bulk add: paste a block, one ingredient or step per line, cleanup buttons | Mealie, Tandoor | none | **copy** as text-only rows; parsing is Later (`claude -p`) |
| Insert above / below, split step per paragraph, merge with next | Mealie, Tandoor | add at end only | **copy** insert; split and merge for steps |
| Per-step image, markdown body with preview | Mealie | plain textarea | **copy** markdown render only; step images are **model** |
| Image from URL as well as upload | Mealie | upload only | **copy** |
| Tag input creates on Enter, `+` opens a create dialog | Mealie | have | **have** |
| Component optional fields revealed from a menu: name, time | Tandoor | name always shown | **copy** the pattern if per-component time is wanted; time is **model** |
| JSON editor of the whole document | Mealie | none | **copy**, cheap, and it is the `claude -p` import preview later |
| Duplicate recipe | Mealie | none | **copy** |
| Confirmations as bottom sheets on phone | Mealie | centred modal | **copy** if the design system's Modal supports it |

## Reference data: foods, units, aisles, tags `/settings`

| Incumbent behaviour | Source | garnish | Action |
|---|---|---|---|
| One generic CRUD table: search, sortable columns, row select, edit dialog, delete confirm listing affected recipes | Mealie, Tandoor | counts only | **copy**; one component for all four |
| Merge two foods or units into one, source deleted, references repointed | Mealie, Tandoor | none | **copy**; needs a repository method, no schema change |
| Food fields: name, plural, aisle, skip shopping, aliases | Mealie, Tandoor | all exist in schema, no UI | **have** the model; **copy** the editor |
| Unit fields: name, plural, abbreviation, use abbreviation, fraction | Mealie | exist, seed only | **copy** the editor |
| Aisle ordering by drag | Tandoor | `position` exists, no UI | **copy** |
| Tag pages: A–Z grouped cards, click filters the list | Mealie | none | **copy** as the tag tab of the same screen |
| Seed foods from a locale list | Mealie | decision 27 says no | **skip** |
| On hand, substitutions, unit conversions, food hierarchy | Mealie, Tandoor | none | **skip** now; conversions are Later |

## Shell

| Incumbent behaviour | Source | garnish | Action |
|---|---|---|---|
| Light / dark toggle in addition to system | Mealie | system only | **copy** |
| Toasts for save, delete, errors, with an action button | Mealie | inline messages | **copy** if the design system has a toast |
| Sidebar sections: Recipes, organisers, settings | Mealie | Recipes, New, Settings | **have**; New moves into a create button once import exists |

## Concepts that would be new

Each needs a decisions.md row before any task touches it. Ordered by how often the incumbents lean on it.

1. Cook log or timeline: `lastMade` exists; a table of (date, rating?, servings?, comment) is what Tandoor and Mealie both build sorts and filters on.
2. Favourite flag on recipe.
3. Categories and tools as organisers beside tags.
4. Step images and per-component time.
5. Timers parsed from step text.
6. Nutrition.

## Questions to settle before the plan

- **Edit in place or a separate route?** Mealie edits on the view page. garnish has a working separate route. Copying Mealie is a rewrite of navigation for little gain on a phone; keeping the route and adding the discard guard is cheaper.
- **Cook log depth.** `lastMade` only, Mealie's "Made this" event with comment and image, or Tandoor's full log with rating and servings per cook. Drives sorts, filters, and the cook mode's done card.
- **Organisers.** Tags only, or add Mealie's categories and tools. Tags only keeps the schema; categories are a second tag namespace.

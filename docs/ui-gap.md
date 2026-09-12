# UI gap: garnish vs the incumbents

Input for the stage 2 plan, now its record. Mealie is the default to copy (decision 17); Tandoor and Cooklang where they are better at the thing garnish borrowed from them. Compiled 2026-09-10 from Mealie `mealie-next` frontend source, Tandoor `vue3/` source, CookCLI templates and the Cooklang app docs, against garnish at `e91bc59`. Status filled in at the end of stage 2; the Action column is left as written so the two can be compared.

Legend, Action column: **have** = garnish had it · **copy** = adopt with no model change · **model** = needs a new field or table (decisions.md row) · **skip** = out of scope per scope.md, listed so it is not re-raised.

Legend, Status column: **done** names the task that shipped it (stage 2 in [plans/v2-ui.md](plans/v2-ui.md), stage 1 in [plans/v1-foundations.md](plans/v1-foundations.md); the live plan is [plan.md](plan.md)) · **deferred** = still wanted, not built, with why · **skipped** = decided against, do not re-raise.

## Already ahead

- Named parts owning ingredients and steps. Mealie fakes sections with a `title` string on the first ingredient or step; Tandoor's shape matches ours.
- Fixed (`=`) quantities, with a visible marker. Neither Mealie nor Cooklang badge them.
- Cook mode as one card per part-ingredients then per step. Matches the Cooklang app; Mealie's cook mode is a two-pane scroll.
- Wake lock, offline read, installable PWA, phone bottom nav. Mealie has no bottom nav.

## Recipe list `/`

| Incumbent behaviour | Source | garnish | Action | Status |
|---|---|---|---|---|
| Card shows image, name, up to 2–3 tag chips, rating, favourite heart | Mealie, Tandoor | image, name, tags | **copy** rating and a total-time chip (Tandoor); favourite is **model** | done M12.1 |
| Grid and list view modes, remembered per device | Mealie | grid only | **copy** (localStorage) | done M12.2 |
| Filters: tags, foods, categories, tools, with any/all switch | Mealie | single tag | **copy** multi-tag any/all and food filter; categories/tools **model**, see Questions | done M12.3; categories and tools deferred (decision 42) |
| Sort: name, created, updated, last made, rating, random; dice for one random recipe | Mealie | none, newest first | **copy** name/created/updated/rating/random; last made after cook log lands | done M12.4 |
| Search box, debounced, query mirrored in URL | Mealie, Tandoor, Cooklang | have | **have** | done (stage 1) |
| Infinite scroll, scroll position restored on back | Mealie | full list, no restore | **copy** restore; paging unnecessary at household size | done M12.2 (restore); paging skipped, not needed at this size |
| `/` opens a global search dialog with arrow-key results | Mealie | none | **copy** | done M12.5 |
| Create menu: URL import, manual | Mealie | New nav item | import is Later; keep one entry point | deferred: import is Later |

## Recipe view `/recipes/$slug`

| Incumbent behaviour | Source | garnish | Action | Status |
|---|---|---|---|---|
| Header: image beside text on wide, stacked on phone; name, rating, description, yield, times with icons | Mealie, Tandoor | stacked always, plain `dl` | **copy** the two layouts and the stat strip | done M11.1 |
| Times as a strip: prep / cook / total | Tandoor | have as `dl` | **copy** styling | done M11.1 |
| Tag chips link to filtered list | all three | have | **have** | done (stage 1) |
| Ingredient tick boxes, strike through, state in sessionStorage | Mealie, Tandoor | none | **copy** | done M11.2 |
| Step done state, tap to dim and collapse | Mealie, Tandoor | none | **copy**, sessionStorage | done M11.4 |
| Ingredient row: quantity, unit, **bold food**, note dimmed on its own line | Mealie | one plain line | **copy** Mealie's render | done M11.2 |
| Ingredient table columns with note as a tooltip icon | Tandoor | | alternative to the line above; pick one | skipped: Mealie's row won |
| Structured vs Summary toggle: per-part tables or one merged list | Tandoor | per-part only | **copy** as a per-device toggle | done M11.3 |
| Ingredients repeated under the step that uses them | Cooklang, Mealie via links | none | **skip** for now; parts already scope ingredients to steps | skipped |
| Scale chip "Serves N" with − / + and a number popover, reset; yield text scales | Mealie | − / + / Reset | **copy** the number input; **have** the rest | done M11.5 |
| Scaled numbers styled differently from base | Tandoor | none | **copy** | done M11.2 |
| Scale so one ingredient hits a target amount | Tandoor | none | **copy**, small | done M11.5 |
| Action menu: Edit, Delete, Duplicate, Print, Copy link, Add to shopping list | Mealie | Edit and Cook buttons | **copy** Duplicate, Print, Copy link; shopping is Later | done M11.6; shopping list is Later |
| Print view with preferences | Mealie | none | **copy**, CSS-first | done M11.6 |
| Copy ingredients as text | Mealie | none | **copy** | done M11.6 |
| Source URL shown in footer, editable | Mealie, Cooklang | field exists, no UI | **have** the field; **copy** the UI | done M11.1 (footer link); editing the field deferred |
| Created / updated footer cards | Tandoor | fields exist, no UI | **copy** | done M11.1 |
| Last made button opening a "Made this" dialog: date, comment, optional image; feeds a timeline | Mealie | `lastMade` field only, no UI | **model**, see Questions | done M11.7 (decision 41) |
| Cook log entry: date, rating, servings, comment; activity list; times-cooked filters | Tandoor | none | **model**, same question | deferred: decision 41 took Mealie's timeline, no per-cook rating or servings |
| Nutrition, assets, comments, share tokens | Mealie | none | **skip**: nutrition is Later at best, the rest is multi-user | skipped |
| Timers from durations in step text | Cooklang app, Tandoor | none | **model**; parked until step text is parsed | deferred: needs step-text parsing |

## Cook mode `/recipes/$slug/cook`

| Incumbent behaviour | Source | garnish | Action | Status |
|---|---|---|---|---|
| Section pills at the top to jump between parts | Cooklang | progress bar and position label | **copy** | done M14.1 |
| Vertical swipe between cards | Cooklang | buttons and arrow keys | **copy** | done M14.1 |
| Ingredient card items tick on tap | Cooklang | plain list | **copy**, shares the view page's sessionStorage state | done M14.2 |
| Step card repeats that step's ingredients | Cooklang | ingredients card per part only | **skip**, no step links | skipped |
| Final "done" card, offering to log the cook | Cooklang, Tandoor | ends on last step | **copy**; the log part depends on the cook log question | done M14.2 |
| ARIA live region announcing the card | Cooklang | none | **copy** | done M14.1 |
| Screen-awake as a labelled switch, persisted | Mealie | automatic with indicator | **have**; add the switch only if the automatic lock annoys | deferred: the pref exists, the switch is unbuilt; the automatic lock has not annoyed |

## Editor `/recipes/new`, `/recipes/$slug/edit`

| Incumbent behaviour | Source | garnish | Action | Status |
|---|---|---|---|---|
| Edit in place on the view page (`?edit=true`), sticky Save, floating save when scrolled, discard-changes guard | Mealie | separate route, no guard | see Questions; the discard guard is **copy** either way | deferred: decision 40 keeps the route; the guard shipped in M13.1 |
| Ingredient rows drag to reorder and drag between parts | Mealie, Tandoor | up/down buttons, "Move to" select | **copy** drag with the buttons kept as fallback | done M13.3 |
| Phone: ingredient row is a one-line summary, tap opens a bottom sheet with the fields | Tandoor | full row of inputs on every width | **copy**; this is the single biggest phone-editor fix | done M13.2 |
| `originalText` shown in grey above a parsed row | Tandoor | hidden unless text-only mode | **copy** | done M13.6 |
| Bulk add: paste a block, one ingredient or step per line, cleanup buttons | Mealie, Tandoor | none | **copy** as text-only rows; parsing is Later (`claude -p`) | done M13.4 |
| Insert above / below, split step per paragraph, merge with next | Mealie, Tandoor | add at end only | **copy** insert; split and merge for steps | done M13.4 |
| Per-step image, markdown body with preview | Mealie | plain textarea | **copy** markdown render only; step images are **model** | done M11.4 (markdown render); step images deferred |
| Image from URL as well as upload | Mealie | upload only | **copy** | done M13.5 |
| Tag input creates on Enter, `+` opens a create dialog | Mealie | have | **have** | done (stage 1) |
| Part optional fields revealed from a menu: name, time | Tandoor | name always shown | **copy** the pattern if per-part time is wanted; time is **model** | deferred: per-part time is a model change |
| JSON editor of the whole document | Mealie | none | **copy**, cheap, and it is the `claude -p` import preview later | done M13.5 |
| Duplicate recipe | Mealie | none | **copy** | done M11.6 |
| Confirmations as bottom sheets on phone | Mealie | centred modal | **copy** if the design system's Modal supports it | done M13.6 (decision 45: Modal is already a sheet on phone) |

## Reference data: foods, units, aisles, tags `/settings`

| Incumbent behaviour | Source | garnish | Action | Status |
|---|---|---|---|---|
| One generic CRUD table: search, sortable columns, row select, edit dialog, delete confirm listing affected recipes | Mealie, Tandoor | counts only | **copy**; one component for all four | done M15.1 |
| Merge two foods or units into one, source deleted, references repointed | Mealie, Tandoor | none | **copy**; needs a repository method, no schema change | done M15.2, M15.3, M15.4 |
| Food fields: name, plural, aisle, skip shopping, aliases | Mealie, Tandoor | all exist in schema, no UI | **have** the model; **copy** the editor | done M15.2 |
| Unit fields: name, plural, abbreviation, use abbreviation, fraction | Mealie | exist, seed only | **copy** the editor | done M15.3 |
| Aisle ordering by drag | Tandoor | `position` exists, no UI | **copy** | done M15.4 |
| Tag pages: A–Z grouped cards, click filters the list | Mealie | none | **copy** as the tag tab of the same screen | done M15.4 |
| Seed foods from a locale list | Mealie | decision 27 says no | **skip** | skipped |
| On hand, substitutions, unit conversions, food hierarchy | Mealie, Tandoor | none | **skip** now; conversions are Later | deferred: conversions are Later |

## Shell

| Incumbent behaviour | Source | garnish | Action | Status |
|---|---|---|---|---|
| Light / dark toggle in addition to system | Mealie | system only | **copy** | done M10.3 |
| Toasts for save, delete, errors, with an action button | Mealie | inline messages | **copy** if the design system has a toast | done M10.3 |
| Sidebar sections: Recipes, organisers, settings | Mealie | Recipes, New, Settings | **have**; New moves into a create button once import exists | done 2026-09-12, ahead of import: New is a "New recipe" button in the recipes page header, and Settings sinks to the bottom of the side nav |

## Concepts that would be new

Each needed a decisions.md row before any task touched it. Ordered by how often the incumbents lean on it.

1. Cook log or timeline — **done**: `timeline_event` in `002_stage2.sql`, Mealie's shape (decision 41).
2. Favourite flag on recipe — **done**: `recipe.favourite` in `002_stage2.sql` (decision 43).
3. Categories and tools as organisers beside tags — **skipped**: tags are the only organiser (decision 42).
4. Step images and per-part time — **deferred**: both are model changes, neither has been missed.
5. Timers parsed from step text — **deferred**: needs the step text parsed, which is the future `claude -p` work.
6. Nutrition — **skipped**: Later at best, see [scope.md](scope.md).

## Questions settled before the plan

- **Edit in place or a separate route?** Separate route kept, decision 40. Mealie's discard guard and sticky Save were copied anyway (M13.1).
- **Cook log depth.** Mealie's "Made this" event with date, comment and image, decision 41. No per-cook rating or servings; `recipe.last_made` is derived from the events (M10.1, M11.7).
- **Organisers.** Tags only, decision 42.
